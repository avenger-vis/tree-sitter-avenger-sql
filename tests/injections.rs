//! The injections of Typst markup and of format patterns into the arguments of avenger-sql's
//! charts, which `scripts/sync_injections.mjs` generates from avenger-sql's
//! `string-arguments.json`: each case's strings take the expected languages, and no others, and
//! every generated pattern matches in some case.

use std::collections::BTreeSet;

use tree_sitter::{Parser, Query, QueryCursor, StreamingIterator};
use tree_sitter_avenger_sql::{INJECTIONS_QUERY, LANGUAGE};

const TYPST: &str = "avenger-typst";
const FORMAT: &str = "avenger-format";

/// Each case: an aggregate item, and the languages and texts that its strings take.
const CASES: &[(&str, &[(&str, &str)])] = &[
    // A function's argument, by name.
    (
        "mark_bar(x => a, y => b, title => '*T*')",
        &[(TYPST, "*T*")],
    ),
    (
        "MARK_TEXT(text => n, format => '%.1f')",
        &[(FORMAT, "%.1f")],
    ),
    (
        "mark_bar(x => x(a, axis => axis(title => '*X*', labels => '%Y')))",
        &[(TYPST, "*X*"), (FORMAT, "%Y")],
    ),
    // A constructor's first argument, and an array.
    (
        "mark_bar(x => x(a, axis => axis(labels => labels('%.2f'))))",
        &[(FORMAT, "%.2f")],
    ),
    (
        "mark_bar(x => x(a, axis => axis(labels => labels(value => '%d', markup => '*l*'))))",
        &[(FORMAT, "%d"), (TYPST, "*l*")],
    ),
    (
        "mark_bar(attribution => attribution(credits => ['*a*', \"_b_\"], separator => ' · '))",
        &[(TYPST, "*a*"), (TYPST, "_b_"), (TYPST, " · ")],
    ),
    // The plot's title in its places, and its subtitle.
    (
        "mark_bar(title => title('*A*', subtitle => '_s_'))",
        &[(TYPST, "*A*"), (TYPST, "_s_")],
    ),
    ("mark_bar(x => x(a, axis => title('X')))", &[(TYPST, "X")]),
    (
        "mark_bar(x => x(a, axis => title(text => 'X')))",
        &[(TYPST, "X")],
    ),
    (
        "mark_bar(color => color(c, legend => title('C')))",
        &[(TYPST, "C")],
    ),
    (
        "mark_bar(color => color(c, legend => title(text => 'C')))",
        &[(TYPST, "C")],
    ),
    ("facet_wrap(c, facet => title('F'))", &[(TYPST, "F")]),
    (
        "facet_wrap(c, facet => title(value => 'F'))",
        &[(TYPST, "F")],
    ),
    (
        "mark_bar(title => title('a', subtitle => subtitle('_s_')))",
        &[(TYPST, "a"), (TYPST, "_s_")],
    ),
    (
        "mark_bar(title => title('a', subtitle => subtitle(text => '_s_')))",
        &[(TYPST, "a"), (TYPST, "_s_")],
    ),
    ("mark_bar(title => subtitle('_s_'))", &[(TYPST, "_s_")]),
    (
        "mark_bar(title => subtitle(text => '_s_'))",
        &[(TYPST, "_s_")],
    ),
    (
        "mark_bar(title => title('*A*', syntax => 'plain', subtitle => subtitle(text => '_s_')))",
        &[],
    ),
    // A plain title, in any quotes and case, and its subtitle.
    (
        "mark_bar(title => title('*A*', syntax => 'plain', subtitle => '_s_'))",
        &[],
    ),
    (
        "mark_bar(title => title('*A*', subtitle => subtitle('_s_'), SYNTAX => \"PLAIN\"))",
        &[],
    ),
    (
        "mark_bar(title => title('*A*', syntax => r'''plain'''))",
        &[],
    ),
    (
        "mark_bar(title => title('*A*', syntax => 'typst', subtitle => '_s_'))",
        &[(TYPST, "*A*"), (TYPST, "_s_")],
    ),
    (
        "mark_bar(title => title('*A*', syntax => 'plain_lines', subtitle => '_s_'))",
        &[],
    ),
    (
        "mark_bar(title => title('*A*', subtitle => subtitle('_s_'), syntax => 'Plain_Lines'))",
        &[],
    ),
    // The tooltip's title, whose first argument is a column.
    (
        "mark_bar(tools => [tooltip(title => title('species', format => '%Y', markup => '*m*'))])",
        &[(FORMAT, "%Y"), (TYPST, "*m*")],
    ),
    (
        "mark_bar(tools => [tooltip(fields => [field(column => 'day', format => '%Y-%m')])])",
        &[(FORMAT, "%Y-%m")],
    ),
    // A string of markup with an escaped backslash, whose injected text would lose it, is left
    // out, and a raw string or another escape keeps the injection.
    ("mark_bar(title => 'a \\\\*b\\\\*')", &[]),
    ("mark_bar(title => r'a \\*b\\*')", &[(TYPST, "a \\*b\\*")]),
    ("mark_bar(title => 'it\\'s *b*')", &[(TYPST, "it\\'s *b*")]),
    (
        "mark_bar(attribution => attribution(credits => ['a', 'b \\\\$']))",
        &[(TYPST, "a")],
    ),
    // Strings that are no markup: a channel's title, a title or a subtitle outside their places,
    // and a string that isn't a call's argument of markup.
    ("mark_bar(y => y(n, title => 'Count'))", &[]),
    ("title('X')", &[]),
    ("subtitle('X')", &[]),
    ("mark_bar(title => CONCAT('*a*', 'b'))", &[]),
];

fn injections(query: &Query, item: &str) -> Vec<(String, String)> {
    let text = format!("FROM t\n|> AGGREGATE {item} AS c\n");
    let language = LANGUAGE.into();
    let mut parser = Parser::new();
    parser.set_language(&language).unwrap();
    let tree = parser.parse(&text, None).unwrap();
    assert!(
        !tree.root_node().has_error(),
        "{item} parses without errors"
    );
    let mut found = Vec::new();
    let mut cursor = QueryCursor::new();
    let mut matches = cursor.matches(query, tree.root_node(), text.as_bytes());
    while let Some(m) = matches.next() {
        let injected = (query.property_settings(m.pattern_index).iter())
            .find(|setting| &*setting.key == "injection.language")
            .and_then(|setting| setting.value.as_deref())
            .unwrap_or_default();
        for capture in m.captures() {
            if query.capture_names()[capture.index as usize] == "injection.content" {
                found.push((
                    capture.node.start_byte(),
                    injected.to_string(),
                    text[capture.node.byte_range()].to_string(),
                ));
            }
        }
    }
    found.sort();
    // Two matches of one string would inject it twice, two layers in Zed.
    let twice: Vec<_> = found.windows(2).filter(|w| w[0].0 == w[1].0).collect();
    assert!(twice.is_empty(), "{item} injects a string twice: {twice:?}");
    found
        .into_iter()
        .map(|(_, language, text)| (language, text))
        .collect()
}

#[test]
fn the_strings_of_charts_take_the_languages_of_string_arguments() {
    let query = Query::new(&LANGUAGE.into(), INJECTIONS_QUERY).unwrap();
    let mut wrong = Vec::new();
    for (item, expected) in CASES {
        let found = injections(&query, item);
        let expected: Vec<(String, String)> = (expected.iter())
            .map(|(language, text)| (language.to_string(), text.to_string()))
            .collect();
        if found != expected {
            wrong.push(format!(
                "{item}\n    expected {expected:?}\n    found    {found:?}"
            ));
        }
    }
    assert!(wrong.is_empty(), "\n{}", wrong.join("\n"));
}

#[test]
fn every_generated_pattern_matches_in_a_case() {
    let language = LANGUAGE.into();
    let query = Query::new(&language, INJECTIONS_QUERY).unwrap();
    let start = INJECTIONS_QUERY
        .find("; generated: ")
        .expect("a generated part");
    let mut parser = Parser::new();
    parser.set_language(&language).unwrap();
    let mut used = BTreeSet::new();
    for (item, _) in CASES {
        let text = format!("FROM t\n|> AGGREGATE {item} AS c\n");
        let tree = parser.parse(&text, None).unwrap();
        let mut cursor = QueryCursor::new();
        let mut matches = cursor.matches(&query, tree.root_node(), text.as_bytes());
        while let Some(m) = matches.next() {
            used.insert(m.pattern_index);
        }
    }
    let unused: Vec<&str> = (0..query.pattern_count())
        .filter(|&pattern| query.start_byte_for_pattern(pattern) > start)
        .filter(|pattern| !used.contains(pattern))
        .map(|pattern| {
            let before = &INJECTIONS_QUERY[..query.start_byte_for_pattern(pattern)];
            before.trim_end().lines().last().unwrap_or_default()
        })
        .collect();
    assert!(
        unused.is_empty(),
        "generated patterns without a match: {unused:#?}"
    );
}
