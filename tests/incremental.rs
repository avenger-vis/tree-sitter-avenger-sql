use serde::Deserialize;
use tree_sitter::{InputEdit, Parser, Point, Tree};

#[derive(Deserialize)]
struct EditManifest {
    schema_version: u32,
    cases: Vec<EditCase>,
}

#[derive(Deserialize)]
struct EditCase {
    id: String,
    initial: String,
    edits: Vec<CheckedEdit>,
    #[serde(rename = "final")]
    final_source: String,
}

#[derive(Deserialize)]
struct CheckedEdit {
    start_byte: usize,
    old_end_byte: usize,
    new_text: String,
    start_point: [usize; 2],
    old_end_point: [usize; 2],
    new_end_point: [usize; 2],
    expected_clean: bool,
    max_changed_bytes: usize,
}

fn parser() -> Parser {
    let mut parser = Parser::new();
    parser
        .set_language(&tree_sitter_avenger_sql::LANGUAGE.into())
        .expect("Avenger SQL language must load");
    parser
}

fn point_at(source: &str, byte: usize) -> Point {
    let prefix = &source.as_bytes()[..byte];
    let row = prefix.iter().filter(|&&value| value == b'\n').count();
    let column = prefix
        .iter()
        .rposition(|&value| value == b'\n')
        .map_or(prefix.len(), |newline| prefix.len() - newline - 1);
    Point::new(row, column)
}

fn replacement_edit(old: &str, new: &str) -> InputEdit {
    let old_bytes = old.as_bytes();
    let new_bytes = new.as_bytes();
    let mut prefix = 0;
    while prefix < old_bytes.len()
        && prefix < new_bytes.len()
        && old_bytes[prefix] == new_bytes[prefix]
    {
        prefix += 1;
    }
    while !old.is_char_boundary(prefix) || !new.is_char_boundary(prefix) {
        prefix -= 1;
    }

    let mut suffix = 0;
    while suffix < old_bytes.len() - prefix
        && suffix < new_bytes.len() - prefix
        && old_bytes[old_bytes.len() - suffix - 1] == new_bytes[new_bytes.len() - suffix - 1]
    {
        suffix += 1;
    }
    while !old.is_char_boundary(old_bytes.len() - suffix)
        || !new.is_char_boundary(new_bytes.len() - suffix)
    {
        suffix -= 1;
    }

    let old_end = old_bytes.len() - suffix;
    let new_end = new_bytes.len() - suffix;
    InputEdit {
        start_byte: prefix,
        old_end_byte: old_end,
        new_end_byte: new_end,
        start_position: point_at(old, prefix),
        old_end_position: point_at(old, old_end),
        new_end_position: point_at(new, new_end),
    }
}

fn assert_incremental_matches_clean(
    parser: &mut Parser,
    old: &str,
    new: &str,
    mut tree: Tree,
) -> Tree {
    let edit = replacement_edit(old, new);
    tree.edit(&edit);
    let incremental = parser.parse(new, Some(&tree)).expect("incremental parse");
    let clean = parser.parse(new, None).expect("clean parse");
    assert_eq!(
        incremental.root_node().to_sexp(),
        clean.root_node().to_sexp(),
        "incremental tree diverged for {old:?} -> {new:?}"
    );
    let changed = tree.changed_ranges(&incremental).collect::<Vec<_>>();
    let changed_bytes = changed
        .iter()
        .map(|range| range.end_byte - range.start_byte)
        .sum::<usize>();
    assert!(
        changed_bytes <= new.len().max(1),
        "changed ranges were not local: {changed:?}"
    );
    incremental
}

#[test]
fn character_by_character_edits_converge_to_clean_trees() {
    let cases = [
        "$width@start",
        "$component.alias",
        "$tag$raw $other$ text$tag$",
        "sum(x) FILTER (WHERE visible) OVER (PARTITION BY group_name)",
        "SELECT m.title FROM vega.movies AS m WHERE m.rating > $minimum",
        "FROM vega.movies AS m SELECT m.title WHERE m.rating > $minimum",
    ];

    for final_source in cases {
        let mut parser = parser();
        let mut source = String::new();
        let mut tree = parser.parse("", None).unwrap();
        for byte in final_source.bytes() {
            let old = source.clone();
            source.push(char::from(byte));
            tree = assert_incremental_matches_clean(&mut parser, &old, &source, tree);
        }
        assert!(
            !tree.root_node().has_error(),
            "{final_source}: {}",
            tree.root_node().to_sexp()
        );
    }
}

#[test]
fn delimiter_and_structure_replacements_converge() {
    let transitions = [
        ("$width@start", "$width@previous"),
        ("$component.alias", "$component.exported.alias"),
        ("'text'", "'te''xt'"),
        ("$$raw$$", "$tag$raw$tag$"),
        ("1 /* block */ + 2", "1 /* outer /* inner */ outer */ + 2"),
        ("f(1, 2)", "f(1, nested(2, 3))"),
        ("[1, 2]", "[1, {value: 2}]"),
        ("SELECT m.x FROM movies m", "SELECT m.x, m.y FROM movies m"),
    ];

    let mut parser = parser();
    for (old, new) in transitions {
        let tree = parser.parse(old, None).unwrap();
        let final_tree = assert_incremental_matches_clean(&mut parser, old, new, tree);
        assert!(
            !final_tree.root_node().has_error(),
            "{new}: {}",
            final_tree.root_node().to_sexp()
        );
    }
}

#[test]
fn quote_close_and_reopen_converges() {
    let mut parser = parser();
    let closed = "'line one\nline two'";
    let open = "'line one\nline two";
    let tree = parser.parse(closed, None).unwrap();
    let open_tree = assert_incremental_matches_clean(&mut parser, closed, open, tree);
    assert!(open_tree.root_node().has_error());
    let repaired = assert_incremental_matches_clean(&mut parser, open, closed, open_tree);
    assert!(!repaired.root_node().has_error());
}

#[test]
fn checked_edit_manifest_converges_with_local_ranges() {
    let manifest: EditManifest =
        serde_json::from_str(include_str!("../test/fixtures/incremental/edits.json")).unwrap();
    assert_eq!(manifest.schema_version, 1);

    for case in manifest.cases {
        let mut parser = parser();
        let mut source = case.initial;
        let mut tree = parser.parse(&source, None).unwrap();
        for edit in case.edits {
            assert_eq!(
                point_at(&source, edit.start_byte),
                Point::new(edit.start_point[0], edit.start_point[1]),
                "{} start point",
                case.id
            );
            assert_eq!(
                point_at(&source, edit.old_end_byte),
                Point::new(edit.old_end_point[0], edit.old_end_point[1]),
                "{} old end point",
                case.id
            );
            let input_edit = InputEdit {
                start_byte: edit.start_byte,
                old_end_byte: edit.old_end_byte,
                new_end_byte: edit.start_byte + edit.new_text.len(),
                start_position: Point::new(edit.start_point[0], edit.start_point[1]),
                old_end_position: Point::new(edit.old_end_point[0], edit.old_end_point[1]),
                new_end_position: Point::new(edit.new_end_point[0], edit.new_end_point[1]),
            };
            source.replace_range(edit.start_byte..edit.old_end_byte, &edit.new_text);
            tree.edit(&input_edit);
            let incremental = parser.parse(&source, Some(&tree)).unwrap();
            let clean = parser.parse(&source, None).unwrap();
            assert_eq!(
                incremental.root_node().to_sexp(),
                clean.root_node().to_sexp(),
                "{} tree",
                case.id
            );
            assert_eq!(
                !incremental.root_node().has_error(),
                edit.expected_clean,
                "{} cleanliness",
                case.id
            );
            let changed_bytes = tree
                .changed_ranges(&incremental)
                .map(|range| range.end_byte - range.start_byte)
                .sum::<usize>();
            assert!(
                changed_bytes <= edit.max_changed_bytes,
                "{} changed {changed_bytes} bytes",
                case.id
            );
            tree = incremental;
        }
        assert_eq!(source, case.final_source, "{} final source", case.id);
    }
}

#[test]
fn scanner_handles_long_and_nested_inputs() {
    let mut parser = parser();

    let tag = format!("tag_{}", "x".repeat(32 * 1024));
    let dollar = format!("${tag}${}${tag}$", "raw;$[]{}\n".repeat(64 * 1024));
    let tree = parser.parse(&dollar, None).unwrap();
    assert!(!tree.root_node().has_error(), "long dollar string failed");

    let depth = 4096;
    let nested = format!("1 {}body{} + 2", "/*".repeat(depth), "*/".repeat(depth));
    let tree = parser.parse(&nested, None).unwrap();
    assert!(!tree.root_node().has_error(), "deep block comment failed");

    let unterminated = format!("1 {}body", "/*".repeat(depth));
    let tree = parser.parse(&unterminated, None).unwrap();
    assert!(
        tree.root_node().has_error(),
        "unterminated comment was clean"
    );
}

#[test]
fn randomized_delimiter_input_always_returns_a_tree() {
    const ALPHABET: &[u8] = b"$'\"/-*:@[]{}();,.abcdefghijklmnopqrstuvwxyz0123456789 \n";
    let mut parser = parser();
    let mut state = 0x9e37_79b9_u32;
    for _ in 0..512 {
        let mut source = String::with_capacity(512);
        for _ in 0..512 {
            state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            source.push(char::from(ALPHABET[state as usize % ALPHABET.len()]));
        }
        assert!(parser.parse(&source, None).is_some());
    }
}
