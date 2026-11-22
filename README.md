# tree-sitter-avenger-sql

The Tree-sitter grammar of avenger-sql, the subset of GoogleSQL with pipe syntax that avenger's charts are written in. It parses chart scripts and data scripts (`.av.sql`) and modules (`.av.sqlm`) with one grammar.

The tree follows avenger-sql-syntax's `sql.ungram`: each named node is a node of `sql.ungram` with the same name in snake case, so `PIPE_SELECT` in the Rust tree is `pipe_select` here. Keywords are anonymous nodes named by their upper-case spelling, such as `"SELECT"`, whatever the case of the text.

This is a tolerant editor parser. A tree without errors does not mean that a script is valid: avenger-sql-syntax and the analysis remain the authority, and the avenger language server reports their errors.

The grammar is being rewritten for the current avenger-sql. It covers the lexical layer, the roots, `FROM`, `|> SELECT`, literals, query parameters, paths, and calls so far.

## Keywords

GoogleSQL's reserved keywords are the grammar's global reserved word set, so they are names only in backticks and as argument names, as in `foo(range => 1)`. The other keywords are names wherever the keyword is not valid. `grammar/keywords.js` is generated from `avenger-sql-syntax/src/syntax_kind.rs`:

```sh
node scripts/sync_keywords.mjs --avenger-root ../avenger
```

Add `--check` to compare the file with the lists without writing it. CI checks it against a pinned avenger commit.

## Strings

The external scanner (`src/scanner.c`) reads strings and bytes literals: single, double, and triple quotes, the prefixes `r`, `b`, `rb`, and `br` in any case, and backslash escapes. A `string` or `bytes` node holds a `string_content` node, whose `escape_sequence` children are the escapes of a literal that is not raw. A literal that is not triple ends at a line end, and any literal ends at the end of the input, so the text after an unclosed quote still parses.

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

`npm test` runs the corpus in `test/corpus/`. `npm run test:scanner` runs the scanner under the address and undefined-behavior sanitizers. `npm run measure -- --write` records the parser's size in `test/metrics/current.json`, which CI compares.

Rust:

```sh
cargo test --release
```
