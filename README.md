# tree-sitter-avenger-sql

The Tree-sitter grammar of avenger-sql, the subset of GoogleSQL with pipe syntax that avenger's charts are written in. It parses chart scripts and data scripts (`.av.sql`) and modules (`.av.sqlm`) with one grammar.

The tree follows avenger-sql-syntax's `sql.ungram`: each named node is a node of `sql.ungram` with the same name in snake case, so `PIPE_SELECT` in the Rust tree is `pipe_select` here. Keywords are anonymous nodes named by their upper-case spelling, such as `"SELECT"`, whatever the case of the text.

This is a tolerant editor parser. A tree without errors does not mean that a script is valid: avenger-sql-syntax and the analysis remain the authority, and the avenger language server reports their errors.

The grammar covers the whole syntax of `sql.ungram`: the statements of chart scripts, data scripts, and modules, every source, join, and pipe operator, `PIVOT`, `UNPIVOT`, `TABLESAMPLE`, `MATCH_RECOGNIZE`, every form of expression with GoogleSQL's operator precedence, and types.

## Keywords

GoogleSQL's reserved keywords are the grammar's global reserved word set, so they are names only in backticks and as argument names, as in `foo(range => 1)`. The other keywords are names wherever the keyword is not valid. `grammar/keywords.js` is generated from `avenger-sql-syntax/src/syntax_kind.rs`:

```sh
node scripts/sync_keywords.mjs --avenger-root ../avenger
```

Add `--check` to compare the file with the lists without writing it. CI checks it against a pinned avenger commit.

## Strings

The external scanner (`src/scanner.c`) reads strings and bytes literals: single, double, and triple quotes, the prefixes `r`, `b`, `rb`, and `br` in any case, and backslash escapes. A `string` or `bytes` node holds a `string_content` node, whose `escape_sequence` children are the escapes of a literal that is not raw. A literal that is not triple ends at a line end, and any literal ends at the end of the input, so the text after an unclosed quote still parses.

## Queries

`queries/highlights.scm` highlights avenger-sql for Zed, q2, and the Tree-sitter CLI. It translates the classes of avenger-sql-syntax's `src/highlight.rs`: a keyword is a keyword only where the parser read it as one, and a name's capture is its role, which the node around it gives, so the path of a table source is a type, the path of a call a function, and the first name of a path expression a column. The capture names are Zed's, and q2's palette spells two of them differently, `comment.doc` and `variable.special`. The strings of `uris` in the options of files stay `@string`, as the language server's semantic tokens give them, where `highlight.rs` gives them a class of their own: a pattern for each URI would share one capture of the option's entry, and the Tree-sitter highlighter, which q2 uses, drops all but one match that share a captured node. No node and no range has two highlight captures, because hosts disagree on which of two wins. The value of a typed literal of a date, a time, or a range is `@string.special`, and of `NUMERIC` and its kin `@number`, on the string's content, so the quotes stay strings. The language server's semantic tokens refine these classes in Zed, as a column from a variable, a mark from a scalar function, or the parts of a date.

`queries/injections.scm` injects JSON into the string of a `JSON` literal, and a regular expression into the pattern of GoogleSQL's eight regex functions, such as `REGEXP_CONTAINS`, when the pattern is a raw string or a string without escape sequences, whose text is the regular expression. The query names all eight, also those that avenger-sql's library doesn't have yet.

Two parts of `highlights.scm` are generated from `src/node-types.json`: the keywords, and the pattern of a column for each type of node that holds an expression. A grammar change that adds a keyword or a place of an expression updates them:

```sh
node scripts/sync_queries.mjs
```

`npm run check-generated` checks them with `--check`. The Rust binding exports the queries as `HIGHLIGHTS_QUERY` and `INJECTIONS_QUERY`.

## Development

Tree-sitter CLI 0.27.2 is pinned in `package-lock.json`.

```sh
npm ci
npm run generate
npm test
npm run check-generated
npm run test:scanner
npm run measure -- --check
npm run build:wasm
```

`npm test` runs the corpus in `test/corpus/`, including `recovery.txt`, which records how the parser recovers from the unfinished text of typing, and the highlight fixtures in `test/highlight/`, whose assertion comments, such as `-- ^ keyword`, give the capture under the caret. `npm run test:scanner` runs the scanner under the address and undefined-behavior sanitizers. `npm run measure -- --write` records the parser's size in `test/metrics/current.json`, which CI compares.

Rust:

```sh
cargo test --release
```

`tests/queries.rs` runs both queries over the highlight fixtures and writes their captures to `tests/output/`. It checks that no node or range has two highlight captures, that every pattern captures in a fixture, and that every capture name is one that Zed's themes and q2's palette show. A change of the captures is accepted by copying the output over `tests/baselines/`.
