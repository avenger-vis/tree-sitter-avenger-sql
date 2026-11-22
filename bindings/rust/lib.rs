//! The Tree-sitter grammar of avenger-sql: chart scripts, data scripts, and modules, in the
//! subset of GoogleSQL that avenger-sql-syntax parses. Its named nodes are the nodes of
//! avenger-sql-syntax's `sql.ungram`, in snake case.
//!
//! The parser is a tolerant editor parser. avenger-sql-syntax and the analysis remain the
//! authority on whether a script is valid.

use tree_sitter_language::LanguageFn;

unsafe extern "C" {
    fn tree_sitter_avenger_sql() -> *const ();
}

/// The Tree-sitter language function for this grammar.
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_avenger_sql) };

/// The generated public node contract.
pub const NODE_TYPES: &str = include_str!("../../src/node-types.json");

#[cfg(test)]
mod tests {
    #[test]
    fn grammar_loads() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("the avenger-sql language loads");
    }
}
