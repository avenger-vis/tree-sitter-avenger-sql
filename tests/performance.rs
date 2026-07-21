use std::hint::black_box;
use std::time::Instant;
use tree_sitter::{InputEdit, Parser, Point};

fn parser() -> Parser {
    let mut parser = Parser::new();
    parser
        .set_language(&tree_sitter_avenger_sql::LANGUAGE.into())
        .unwrap();
    parser
}

#[test]
#[ignore = "records local timing; run explicitly for release evidence"]
fn record_clean_and_incremental_timing() {
    const ITERATIONS: u32 = 2_000;
    const PREFIX: &str = "-- changed\n";
    let source = include_str!("../test/fixtures/performance/large_query.avenger.sql");
    let edited_source = format!("{PREFIX}{source}");
    let mut parser = parser();

    for _ in 0..100 {
        black_box(parser.parse(source, None).unwrap());
    }
    let clean_start = Instant::now();
    for _ in 0..ITERATIONS {
        let tree = parser.parse(black_box(source), None).unwrap();
        assert!(!tree.root_node().has_error());
        black_box(tree);
    }
    let clean = clean_start.elapsed();

    let original = parser.parse(source, None).unwrap();
    let edit = InputEdit {
        start_byte: 0,
        old_end_byte: 0,
        new_end_byte: PREFIX.len(),
        start_position: Point::new(0, 0),
        old_end_position: Point::new(0, 0),
        new_end_position: Point::new(1, 0),
    };
    let incremental_start = Instant::now();
    for _ in 0..ITERATIONS {
        let mut old = original.clone();
        old.edit(&edit);
        let tree = parser.parse(black_box(&edited_source), Some(&old)).unwrap();
        assert!(!tree.root_node().has_error());
        black_box(tree);
    }
    let incremental = incremental_start.elapsed();

    println!(
        "{{\"iterations\":{ITERATIONS},\"fixture_bytes\":{},\"clean_total_ns\":{},\"clean_mean_ns\":{},\"incremental_total_ns\":{},\"incremental_mean_ns\":{}}}",
        source.len(),
        clean.as_nanos(),
        clean.as_nanos() / u128::from(ITERATIONS),
        incremental.as_nanos(),
        incremental.as_nanos() / u128::from(ITERATIONS),
    );
}
