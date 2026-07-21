//! Tree-sitter grammar for Avenger's read-only SQL query and scalar-expression
//! surface.
//!
//! The parser is intentionally tolerant and intended for editor tooling. The
//! Avenger compiler remains the authority for syntax and semantics.

use tree_sitter_language::LanguageFn;

unsafe extern "C" {
    fn tree_sitter_avenger_sql() -> *const ();
}

/// The Tree-sitter language function for this grammar.
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_avenger_sql) };

/// The generated public node contract.
pub const NODE_TYPES: &str = include_str!("../../src/node-types.json");

/// Syntax-highlight query for the standalone SQL grammar.
pub const HIGHLIGHTS_QUERY: &str = include_str!("../../queries/highlights.scm");

#[cfg(test)]
mod tests {
    #[test]
    fn grammar_loads() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Avenger SQL language must load");
    }
}
