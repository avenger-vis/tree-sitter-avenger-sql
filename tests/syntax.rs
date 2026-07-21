fn parser() -> tree_sitter::Parser {
    let mut parser = tree_sitter::Parser::new();
    parser
        .set_language(&tree_sitter_avenger_sql::LANGUAGE.into())
        .expect("Avenger SQL language must load");
    parser
}

fn assert_clean(cases: &[&str]) {
    let mut parser = parser();
    let failures = cases
        .iter()
        .filter_map(|source| {
            let tree = parser
                .parse(source, None)
                .expect("parse must return a tree");
            tree.root_node()
                .has_error()
                .then(|| format!("source: {source}\ntree: {}", tree.root_node().to_sexp()))
        })
        .collect::<Vec<_>>();
    assert!(
        failures.is_empty(),
        "unclean parses:\n\n{}",
        failures.join("\n\n")
    );
}

fn assert_has_error(cases: &[&str]) {
    let mut parser = parser();
    let failures = cases
        .iter()
        .filter_map(|source| {
            let tree = parser
                .parse(source, None)
                .expect("parse must return a tree");
            (!tree.root_node().has_error()).then(|| {
                format!(
                    "source unexpectedly clean: {source}\ntree: {}",
                    tree.root_node().to_sexp()
                )
            })
        })
        .collect::<Vec<_>>();
    assert!(
        failures.is_empty(),
        "invalid syntax accepted:\n\n{}",
        failures.join("\n\n")
    );
}

#[test]
fn checked_datafusion_expression_surface_is_clean() {
    assert_clean(&[
        r#""horsepower" / nullif("weight", 0)"#,
        r#"coalesce("category", 'unknown')"#,
        r#"CASE WHEN "value" > 10 THEN 'large' ELSE 'small' END"#,
        r#"CAST("timestamp" AS TIMESTAMP) + INTERVAL '1 day'"#,
        r#"date_trunc('month', "timestamp")"#,
        r#"sqrt(pow("x", 2) + pow("y", 2))"#,
        r#"array_element(["low", "medium", "high"], 2)"#,
        r#"regexp_like("name", '^A') AND "enabled" IS NOT NULL"#,
        r#"sum("value") FILTER (WHERE "visible") OVER (PARTITION BY "group")"#,
        r#"span(min("x"), max("x"))"#,
        "span_ordered($brush.left, $brush.right)",
        r#""rating"::double precision"#,
        "$config:theme.color",
        "[1, 2, coalesce(3, nested(4, 5))]",
        "{key: 'value', nested: {enabled: true}}",
        r#"catalog.schema."table"."column""#,
        "a NOT BETWEEN 1 AND 2",
        "a NOT IN (1, 2, 3)",
        "a NOT LIKE '%x%'",
        "a IS DISTINCT FROM b",
        "a IS NOT DISTINCT FROM b",
        "EXISTS (SELECT 1 FROM t WHERE t.x = outer_t.x)",
        "f(value => 1, other := 2)",
        "sum(x ORDER BY y DESC) FILTER (WHERE visible) OVER (PARTITION BY g ORDER BY t ROWS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE NO OTHERS)",
        "items[1]",
        "items[1:3]",
        "a @> b AND c <@ d",
    ]);
}

#[test]
fn checked_read_query_surface_is_clean() {
    assert_clean(&[
        r#"SELECT m."title" FROM vega.movies AS m"#,
        r#"FROM vega.movies AS m SELECT m."title""#,
        r#"WITH filtered AS (SELECT "x" FROM source WHERE "x" > 0) SELECT * FROM filtered"#,
        "VALUES (1, 'one'), (2, 'two')",
        "SELECT category FROM movies UNION ALL SELECT category FROM movies",
        "SELECT count(*) FROM $brush",
        "SELECT m.*, count(*) AS n FROM catalog.schema.movies m LEFT OUTER JOIN other o ON m.id = o.id WHERE m.visible GROUP BY m.category HAVING count(*) > 1 ORDER BY n DESC NULLS LAST LIMIT 10 OFFSET 2",
        "FROM a CROSS JOIN b SELECT a.x, b.y",
        "SELECT * FROM (VALUES (1), (2)) AS v(x)",
        "SELECT * FROM table_function($config)",
        "WITH RECURSIVE numbers(n) AS (VALUES (1)) SELECT n FROM numbers",
        "SELECT x FROM a INTERSECT SELECT x FROM b UNION SELECT x FROM c EXCEPT SELECT x FROM d",
        "SELECT sum(x) OVER named FROM t WINDOW named AS (PARTITION BY g)",
        "SELECT ';' AS \"semicolon\" /* ; */;",
    ]);
}

#[test]
fn unsupported_surface_has_recovery() {
    assert_has_error(&[
        "FROM movies",
        "CREATE TABLE t (x INT)",
        "INSERT INTO t VALUES (1)",
        "UPDATE t SET x = 1",
        "DELETE FROM t",
        "SELECT 1; SELECT 2",
        "$1",
        "?",
        "$width @start",
        "$width@initial",
        "$",
        "$component.",
        "$component.123",
        "$component.\"alias\"",
        "a # b",
        "'''triple'''",
        "`column`",
        "1_000",
    ]);
}

#[test]
fn stable_root_fields_distinguish_queries_and_expressions() {
    let mut parser = parser();
    let expression = parser.parse("1 + 2", None).unwrap();
    assert!(expression
        .root_node()
        .child_by_field_name("expression")
        .is_some());
    assert!(expression
        .root_node()
        .child_by_field_name("query")
        .is_none());

    let query = parser.parse("SELECT 1", None).unwrap();
    assert!(query.root_node().child_by_field_name("query").is_some());
    assert!(query
        .root_node()
        .child_by_field_name("expression")
        .is_none());
}

#[test]
fn standard_and_from_first_share_roles_but_preserve_source_order() {
    let mut parser = parser();
    for (source, from_first) in [
        ("SELECT m.x FROM movies AS m WHERE m.x > 0", false),
        ("FROM movies AS m SELECT m.x WHERE m.x > 0", true),
    ] {
        let tree = parser.parse(source, None).unwrap();
        assert!(
            !tree.root_node().has_error(),
            "{}",
            tree.root_node().to_sexp()
        );
        let query = tree.root_node().child_by_field_name("query").unwrap();
        let select = query.child_by_field_name("body").unwrap();
        assert_eq!(select.kind(), "select_query");
        let from = select.child_by_field_name("from").unwrap();
        let select_clause = (0..select.named_child_count())
            .filter_map(|index| select.named_child(index as u32))
            .find(|node| node.kind() == "select_clause")
            .unwrap();
        assert_eq!(from.start_byte() < select_clause.start_byte(), from_first);
        assert!(select_clause.child_by_field_name("projection").is_some());
        assert!((0..select.named_child_count())
            .filter_map(|index| select.named_child(index as u32))
            .any(|node| node.kind() == "where_clause"));
    }
}

#[test]
fn standard_and_from_first_feature_pairs_are_clean() {
    assert_clean(&[
        "SELECT m.g, sum(m.x) AS total FROM movies m LEFT JOIN other o ON m.id = o.id WHERE m.visible GROUP BY m.g HAVING sum(m.x) > 0 ORDER BY total DESC LIMIT 5",
        "FROM movies m LEFT JOIN other o ON m.id = o.id SELECT m.g, sum(m.x) AS total WHERE m.visible GROUP BY m.g HAVING sum(m.x) > 0 ORDER BY total DESC LIMIT 5",
        "SELECT sum(x) OVER (PARTITION BY g ORDER BY t) FROM events",
        "FROM events SELECT sum(x) OVER (PARTITION BY g ORDER BY t)",
        "WITH filtered AS (SELECT * FROM source WHERE visible) SELECT * FROM filtered",
        "WITH filtered AS (SELECT * FROM source WHERE visible) FROM filtered SELECT *",
        "SELECT x FROM a UNION ALL SELECT x FROM b",
        "FROM a SELECT x UNION ALL FROM b SELECT x",
    ]);
}

#[test]
fn intersect_binds_more_tightly_than_union() {
    let mut parser = parser();
    let tree = parser
        .parse(
            "SELECT x FROM a INTERSECT SELECT x FROM b UNION SELECT x FROM c",
            None,
        )
        .unwrap();
    let sexp = tree.root_node().to_sexp();
    assert!(!tree.root_node().has_error(), "{sexp}");
    assert!(
        sexp.contains("(union_except_operation left: (intersect_operation"),
        "{sexp}"
    );
}

#[test]
fn precedence_matches_sql_shape() {
    let mut parser = parser();
    let cases = [
        (
            "1 + 2 * 3",
            "(binary_expression left: (literal (number)) right: (binary_expression",
        ),
        (
            "NOT a = b",
            "(unary_expression operator: (keyword_not) operand: (binary_expression",
        ),
        ("a OR b AND c", "right: (binary_expression"),
    ];
    for (source, expected_fragment) in cases {
        let tree = parser.parse(source, None).unwrap();
        let sexp = tree.root_node().to_sexp();
        assert!(!tree.root_node().has_error(), "{source}: {sexp}");
        assert!(sexp.contains(expected_fragment), "{source}: {sexp}");
    }
}
