//! The queries over the highlight fixtures of `test/highlight/`: the captures of each fixture
//! match its baseline in `tests/baselines/`, no node or range has two highlight captures, every
//! pattern of `highlights.scm` captures in some fixture, and every capture name is one that Zed
//! and q2 show. The format strings that the fixtures inject parse in the format grammar, and
//! every pattern of its `highlights.scm` captures in them.
//!
//! A test writes the captures of each fixture to `tests/output/`, and a change of them is
//! accepted by copying the output over the baseline.

use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::PathBuf,
};

use tree_sitter::{Language, Node, Parser, Query, QueryCursor, StreamingIterator};
use tree_sitter_avenger_sql::{
    FORMAT_HIGHLIGHTS_QUERY, FORMAT_LANGUAGE, HIGHLIGHTS_QUERY, INJECTIONS_QUERY, LANGUAGE,
};

/// The capture names that Zed documents (`docs/src/extensions/languages.md`) or that its bundled
/// themes, One, Ayu, and Gruvbox, style.
const ZED: &[&str] = &[
    "attribute",
    "boolean",
    "comment",
    "comment.doc",
    "constant",
    "constructor",
    "embedded",
    "emphasis",
    "emphasis.strong",
    "enum",
    "function",
    "function.builtin",
    "hint",
    "keyword",
    "label",
    "link_text",
    "link_uri",
    "namespace",
    "number",
    "operator",
    "predictive",
    "preproc",
    "primary",
    "property",
    "punctuation",
    "punctuation.bracket",
    "punctuation.delimiter",
    "punctuation.list_marker",
    "punctuation.markup",
    "punctuation.special",
    "selector",
    "selector.pseudo",
    "string",
    "string.escape",
    "string.regex",
    "string.special",
    "string.special.symbol",
    "tag",
    "tag.doctype",
    "text.literal",
    "title",
    "type",
    "variable",
    "variable.special",
    "variant",
];

/// The refined captures that Zed's themes don't style, which take the style of their prefix by
/// Zed's lookup and show their own in a theme that styles them.
const ZED_FALLBACKS: &[(&str, &str)] = &[
    ("constant.builtin", "constant"),
    ("type.builtin", "type"),
    ("variable.parameter", "variable"),
];

/// The captures that q2's palette spells differently, and its names of them.
const Q2_RENAMES: &[(&str, &str)] = &[
    ("comment.doc", "comment.documentation"),
    ("variable.special", "variable.builtin"),
];

/// The classes of q2's default palette (`resources/scss/html/templates/highlight-default.scss`),
/// each a capture with its dots as hyphens.
const Q2: &[&str] = &[
    "attribute",
    "boolean",
    "character",
    "comment",
    "comment-block",
    "comment-documentation",
    "comment-line",
    "comment-unused",
    "constant",
    "constant-builtin",
    "constant-character",
    "constant-numeric",
    "constructor",
    "constructor-builtin",
    "embedded",
    "error",
    "escape",
    "function",
    "function-builtin",
    "function-macro",
    "function-method",
    "function-special",
    "keyword",
    "keyword-conditional",
    "keyword-control",
    "keyword-directive",
    "keyword-function",
    "keyword-operator",
    "keyword-repeat",
    "keyword-storage",
    "label",
    "markup-bold",
    "markup-heading",
    "markup-italic",
    "markup-link",
    "markup-link-url",
    "markup-raw",
    "markup-strikethrough",
    "module",
    "namespace",
    "number",
    "operator",
    "operator-word",
    "property",
    "property-builtin",
    "punctuation",
    "punctuation-bracket",
    "punctuation-delimiter",
    "punctuation-special",
    "special",
    "string",
    "string-escape",
    "string-regexp",
    "string-special",
    "string-special-symbol",
    "tag",
    "type",
    "type-builtin",
    "type-enum",
    "type-parameter",
    "variable",
    "variable-builtin",
    "variable-member",
    "variable-mutable",
    "variable-other",
    "variable-parameter",
];

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn language() -> Language {
    LANGUAGE.into()
}

/// The fixtures of `test/highlight/`, by name, in order.
fn fixtures() -> Vec<(String, String)> {
    let mut fixtures: Vec<(String, String)> = fs::read_dir(root().join("test/highlight"))
        .expect("the highlight fixtures")
        .map(|entry| entry.expect("a fixture").path())
        .filter(|path| path.to_string_lossy().ends_with(".av.sql"))
        .map(|path| {
            let name = path.file_name().unwrap().to_string_lossy().to_string();
            (name, fs::read_to_string(&path).expect("a fixture's text"))
        })
        .collect();
    fixtures.sort();
    assert!(!fixtures.is_empty(), "test/highlight has fixtures");
    fixtures
}

/// One capture: its pattern, its name, and its node.
struct Capture<'tree> {
    pattern: usize,
    name: String,
    node: Node<'tree>,
}

/// The captures of `query` over `text`, in the order of the text, without the captures whose
/// names start with `_`, which only predicates read.
fn captures<'tree>(
    query: &Query,
    tree: &'tree tree_sitter::Tree,
    text: &str,
) -> Vec<Capture<'tree>> {
    let mut cursor = QueryCursor::new();
    let mut found = Vec::new();
    let mut matches = cursor.captures(query, tree.root_node(), text.as_bytes());
    while let Some((m, index)) = matches.next() {
        let capture = m.captures()[*index];
        let name = query.capture_names()[capture.index as usize];
        if name.starts_with('_') {
            continue;
        }
        found.push(Capture {
            pattern: m.pattern_index,
            name: name.to_string(),
            node: capture.node,
        });
    }
    found
}

/// The lines of `captures`: the range, the capture name, and the text of each.
fn lines(captures: &[Capture], text: &str) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();
    for capture in captures {
        let (start, end) = (capture.node.start_position(), capture.node.end_position());
        let line = format!(
            "{}:{}-{}:{} {} {:?}",
            start.row,
            start.column,
            end.row,
            end.column,
            capture.name,
            &text[capture.node.byte_range()]
        );
        if lines.last() != Some(&line) {
            lines.push(line);
        }
    }
    lines
}

#[test]
fn the_captures_of_each_fixture_match_its_baseline() {
    let language = language();
    let highlights = Query::new(&language, HIGHLIGHTS_QUERY).expect("highlights.scm compiles");
    let injections = Query::new(&language, INJECTIONS_QUERY).expect("injections.scm compiles");
    let mut parser = Parser::new();
    parser.set_language(&language).unwrap();
    let output = root().join("tests/output");
    fs::create_dir_all(&output).unwrap();
    let mut differ = Vec::new();
    for (name, text) in fixtures() {
        let tree = parser.parse(&text, None).expect("a tree");
        assert!(
            !tree.root_node().has_error(),
            "{name} parses without errors"
        );
        let mut written = String::from("highlights\n");
        for line in lines(&captures(&highlights, &tree, &text), &text) {
            written.push_str(&line);
            written.push('\n');
        }
        written.push_str("\ninjections\n");
        for line in lines(&captures(&injections, &tree, &text), &text) {
            written.push_str(&line);
            written.push('\n');
        }
        let file = format!("{}.txt", name.trim_end_matches(".av.sql"));
        fs::write(output.join(&file), &written).unwrap();
        let baseline = root().join("tests/baselines").join(&file);
        if fs::read_to_string(&baseline).unwrap_or_default() != written {
            differ.push(format!(
                "{} differs from {}",
                output.join(&file).display(),
                baseline.display()
            ));
        }
    }
    assert!(
        differ.is_empty(),
        "accept a change by copying the output over the baseline:\n{}",
        differ.join("\n")
    );
}

#[test]
fn no_node_or_range_has_two_highlight_captures() {
    let language = language();
    let query = Query::new(&language, HIGHLIGHTS_QUERY).unwrap();
    let mut parser = Parser::new();
    parser.set_language(&language).unwrap();
    let mut doubles = Vec::new();
    for (name, text) in fixtures() {
        let tree = parser.parse(&text, None).unwrap();
        let mut by_range: BTreeMap<(usize, usize), BTreeSet<(usize, String)>> = BTreeMap::new();
        for capture in captures(&query, &tree, &text) {
            let range = capture.node.byte_range();
            by_range
                .entry((range.start, range.end))
                .or_default()
                .insert((capture.pattern, capture.name));
        }
        for ((start, end), found) in by_range {
            if found.len() > 1 {
                doubles.push(format!("{name}: {:?} has {found:?}", &text[start..end]));
            }
        }
    }
    assert!(doubles.is_empty(), "\n{}", doubles.join("\n"));
}

#[test]
fn every_highlight_pattern_captures_in_a_fixture() {
    let language = language();
    let query = Query::new(&language, HIGHLIGHTS_QUERY).unwrap();
    let mut parser = Parser::new();
    parser.set_language(&language).unwrap();
    let mut used = BTreeSet::new();
    for (_, text) in fixtures() {
        let tree = parser.parse(&text, None).unwrap();
        used.extend(
            captures(&query, &tree, &text)
                .iter()
                .map(|capture| capture.pattern),
        );
    }
    let unused: Vec<String> = (0..query.pattern_count())
        .filter(|pattern| !used.contains(pattern))
        .map(|pattern| {
            let start = query.start_byte_for_pattern(pattern);
            let first = HIGHLIGHTS_QUERY[start..].lines().next().unwrap_or_default();
            let line = HIGHLIGHTS_QUERY[..start].lines().count() + 1;
            format!("line {line}: {first}")
        })
        .collect();
    assert!(
        unused.is_empty(),
        "patterns without a capture in the fixtures:\n{}",
        unused.join("\n")
    );
}

#[test]
fn every_capture_is_a_name_that_zed_and_q2_show() {
    let query = Query::new(&language(), HIGHLIGHTS_QUERY).unwrap();
    let format = Query::new(&FORMAT_LANGUAGE.into(), FORMAT_HIGHLIGHTS_QUERY).unwrap();
    let mut wrong = Vec::new();
    for name in (query.capture_names().iter())
        .chain(format.capture_names())
        .filter(|name| !name.starts_with('_'))
    {
        let zed = ZED.contains(name) || ZED_FALLBACKS.iter().any(|(refined, _)| refined == name);
        if !zed {
            wrong.push(format!("`{name}` is no capture that Zed shows"));
        }
        let renamed = (Q2_RENAMES.iter())
            .find(|(zed, _)| zed == name)
            .map_or(*name, |(_, q2)| *q2);
        if !Q2.contains(&renamed.replace('.', "-").as_str()) {
            wrong.push(format!(
                "`{name}`, as `{renamed}`, is no class of q2's palette"
            ));
        }
    }
    for (refined, prefix) in ZED_FALLBACKS {
        assert!(
            ZED.contains(prefix),
            "the prefix of `{refined}` is a capture that Zed shows"
        );
    }
    assert!(wrong.is_empty(), "\n{}", wrong.join("\n"));
}

#[test]
fn the_injected_formats_parse_and_take_every_format_pattern() {
    let language = language();
    let injections = Query::new(&language, INJECTIONS_QUERY).unwrap();
    let format_language: Language = FORMAT_LANGUAGE.into();
    let format_query = Query::new(&format_language, FORMAT_HIGHLIGHTS_QUERY).unwrap();
    let mut parser = Parser::new();
    parser.set_language(&language).unwrap();
    let mut format_parser = Parser::new();
    format_parser.set_language(&format_language).unwrap();
    let mut formats = Vec::new();
    for (_, text) in fixtures() {
        let tree = parser.parse(&text, None).unwrap();
        let mut cursor = QueryCursor::new();
        let mut matches = cursor.matches(&injections, tree.root_node(), text.as_bytes());
        while let Some(m) = matches.next() {
            let language = injections
                .property_settings(m.pattern_index)
                .iter()
                .find(|setting| &*setting.key == "injection.language")
                .and_then(|setting| setting.value.as_deref());
            if language != Some("avenger-format") {
                continue;
            }
            for capture in m.captures() {
                if injections.capture_names()[capture.index as usize] == "injection.content" {
                    formats.push(text[capture.node.byte_range()].to_string());
                }
            }
        }
    }
    assert!(!formats.is_empty(), "the fixtures inject formats");
    let mut used = BTreeSet::new();
    for format in &formats {
        let tree = format_parser.parse(format, None).unwrap();
        assert!(
            !tree.root_node().has_error(),
            "{format:?} parses without errors"
        );
        used.extend(
            captures(&format_query, &tree, format)
                .iter()
                .map(|capture| capture.pattern),
        );
    }
    let unused: Vec<usize> = (0..format_query.pattern_count())
        .filter(|pattern| !used.contains(pattern))
        .collect();
    assert!(
        unused.is_empty(),
        "patterns of the format grammar without a capture: {unused:?}"
    );
}
