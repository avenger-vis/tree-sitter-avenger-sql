//! The Tree-sitter grammar of avenger-sql: chart scripts, data scripts, and modules, in the
//! subset of GoogleSQL that avenger-sql-syntax parses. Its named nodes are the nodes of
//! avenger-sql-syntax's `sql.ungram`, in snake case.
//!
//! The parser is a tolerant editor parser. avenger-sql-syntax and the analysis remain the
//! authority on whether a script is valid.
//!
//! A second grammar, `avenger_format`, reads GoogleSQL's format strings, which the injections
//! query injects into the format of `FORMAT_DATE` and its kin.

use tree_sitter_language::LanguageFn;

unsafe extern "C" {
    fn tree_sitter_avenger_sql() -> *const ();
    fn tree_sitter_avenger_format() -> *const ();
}

/// The Tree-sitter language function for this grammar.
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_avenger_sql) };

/// The generated public node contract.
pub const NODE_TYPES: &str = include_str!("../../src/node-types.json");

/// The highlighting query, whose capture names are Zed's.
pub const HIGHLIGHTS_QUERY: &str = include_str!("../../queries/highlights.scm");

/// The injections query: JSON in a `JSON` literal, regular expressions in the patterns of the
/// regex functions, and format strings in the formats of the functions that format and parse
/// dates and times.
pub const INJECTIONS_QUERY: &str = include_str!("../../queries/injections.scm");

/// The Tree-sitter language function of GoogleSQL's format strings, which `INJECTIONS_QUERY`
/// injects as `avenger-format`.
pub const FORMAT_LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_avenger_format) };

/// The generated public node contract of the format grammar.
pub const FORMAT_NODE_TYPES: &str = include_str!("../../format/src/node-types.json");

/// The highlighting query of the format grammar, whose capture names are Zed's.
pub const FORMAT_HIGHLIGHTS_QUERY: &str = include_str!("../../format/queries/highlights.scm");

#[cfg(test)]
mod tests {
    #[test]
    fn grammar_loads() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("the avenger-sql language loads");
    }

    #[test]
    fn queries_compile() {
        let language = super::LANGUAGE.into();
        for query in [super::HIGHLIGHTS_QUERY, super::INJECTIONS_QUERY] {
            tree_sitter::Query::new(&language, query).expect("the query compiles");
        }
        let format = super::FORMAT_LANGUAGE.into();
        tree_sitter::Query::new(&format, super::FORMAT_HIGHLIGHTS_QUERY)
            .expect("the format query compiles");
    }
}
