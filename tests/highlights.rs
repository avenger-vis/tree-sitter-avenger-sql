use std::collections::HashSet;
use tree_sitter::{Query, QueryCursor, StreamingIterator};

#[test]
fn highlight_query_captures_the_public_surface() {
    let source = include_str!("../test/highlight/surface.avenger.sql");
    let language = tree_sitter_avenger_sql::LANGUAGE.into();
    let mut parser = tree_sitter::Parser::new();
    parser.set_language(&language).unwrap();
    let tree = parser.parse(source, None).unwrap();
    assert!(
        !tree.root_node().has_error(),
        "{}",
        tree.root_node().to_sexp()
    );

    let query = Query::new(&language, tree_sitter_avenger_sql::HIGHLIGHTS_QUERY)
        .expect("highlight query must compile");
    let capture_names = query.capture_names();
    let mut cursor = QueryCursor::new();
    let mut captures = cursor.captures(&query, tree.root_node(), source.as_bytes());
    let mut observed = HashSet::new();
    while let Some((query_match, capture_index)) = captures.next() {
        let capture = query_match.captures[*capture_index];
        let text = &source[capture.node.byte_range()];
        observed.insert((capture_names[capture.index as usize], text));
    }

    for expected in [
        ("comment", "-- query comment\n"),
        ("keyword", "FROM"),
        ("type", "vega"),
        ("variable.parameter", "m"),
        ("function", "sum"),
        ("variable", "\"label\""),
        ("variable.parameter", "$"),
        ("variable.special", "$"),
        ("variable.special", "config"),
        ("attribute", "@previous"),
        ("property", "theme"),
        ("string.escape", "E'line\\nnext'"),
        ("string", "$$raw\ntext$$"),
        ("string.special", "X'deadbeef'"),
        ("number", "1.5"),
        ("operator", ">="),
        ("punctuation.delimiter", "."),
    ] {
        assert!(
            observed.contains(&expected),
            "missing capture {expected:?}; observed: {observed:#?}"
        );
    }
}
