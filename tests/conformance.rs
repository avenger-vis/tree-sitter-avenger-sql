use serde::Deserialize;

#[derive(Deserialize)]
struct SynchronizedManifest {
    manifest: Manifest,
}

#[derive(Deserialize)]
struct Manifest {
    cases: Vec<Case>,
}

#[derive(Deserialize)]
struct Case {
    id: String,
    category: String,
    source: String,
    accepted: bool,
}

fn parser() -> tree_sitter::Parser {
    let mut parser = tree_sitter::Parser::new();
    parser
        .set_language(&tree_sitter_avenger_sql::LANGUAGE.into())
        .expect("Avenger SQL language must load");
    parser
}

fn source_for_parser(case: &Case) -> String {
    if case.category != "comment" {
        return case.source.clone();
    }

    match case.id.as_str() {
        "comment_line" | "comment_unicode_space" | "comment_tab" => {
            format!("1 {} + 2", case.source)
        }
        "comment_crlf" => "1 -- comment\r\n + next".into(),
        "comment_bare_cr" => "1 --\rcomment".into(),
        "comment_no_space" => "1--comment".into(),
        "comment_bare_operators" => "1--2".into(),
        "comment_decrement" => case.source.clone(),
        "comment_nested_block" | "comment_unterminated_block" => {
            format!("1 {} + 2", case.source)
        }
        id => panic!("comment fixture {id} has no Tree-sitter embedding"),
    }
}

#[test]
fn synchronized_manifest_matches_clean_parse_expectations() {
    let synchronized: SynchronizedManifest = serde_json::from_str(include_str!(
        "../test/fixtures/avenger-sql-conformance.json"
    ))
    .expect("conformance manifest must be valid JSON");
    let mut parser = parser();
    let mut mismatches = Vec::new();

    for case in synchronized.manifest.cases {
        let source = source_for_parser(&case);
        let tree = parser.parse(&source, None).expect("parser must return a tree");
        let clean = !tree.root_node().has_error();
        if clean != case.accepted {
            mismatches.push(format!(
                "{}: expected accepted={}, clean={}\nsource: {:?}\ntree: {}",
                case.id,
                case.accepted,
                clean,
                source,
                tree.root_node().to_sexp()
            ));
        }
    }

    assert!(
        mismatches.is_empty(),
        "Tree-sitter conformance mismatches:\n\n{}",
        mismatches.join("\n\n")
    );
}
