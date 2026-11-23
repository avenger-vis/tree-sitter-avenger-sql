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

`queries/highlights.scm` highlights avenger-sql for Zed, q2, and the Tree-sitter CLI. It translates the classes of avenger-sql-syntax's `src/highlight.rs`: a keyword is a keyword only where the parser read it as one, and a name's capture is its role, which the node around it gives, so the path of a table source is a type, the path of a call a function, and the first name of a path expression a column. The capture names are Zed's, and q2's palette spells two of them differently, `comment.doc` and `variable.special`. The strings of `uris` in the options of files stay `@string`, as the language server's semantic tokens give them, where `highlight.rs` gives them a class of their own: a pattern for each URI would share one capture of the option's entry, and the Tree-sitter highlighter, which q2 uses, drops all but one match that share a captured node. No node and no range has two highlight captures, because hosts disagree on which of two wins. The value of a typed literal of a date, a time, or a range is `@string.special`, and of `NUMERIC` and its kin `@number`, on the string's content, so the quotes stay strings, and the injection of `avenger-datetime` colors the parts of a date over it where a host draws injections. The language server's semantic tokens refine these classes in Zed, as a column from a variable, or a mark from a scalar function.

`queries/injections.scm` injects JSON into the string of a `JSON` literal, `avenger-datetime` into the value of a `DATE`, `TIME`, `DATETIME`, `TIMESTAMP`, or `RANGE<T>` literal, and a regular expression into the pattern of GoogleSQL's eight regex functions, such as `REGEXP_CONTAINS`, when the pattern is a raw string or a string without escape sequences, whose text is the regular expression. The query names all eight, also those that avenger-sql's library doesn't have yet. It also injects `avenger-format` into the format of the functions that format and parse dates and times, such as `FORMAT_DATE`, and of `FORMAT`: their first argument.

The query also injects `avenger-typst`, the grammar of [tree-sitter-avenger-typst](https://github.com/avenger-vis/tree-sitter-avenger-typst), into the Typst markup of charts, and `avenger-format` into their format patterns, as in `title => '*Penguins*'` and `labels(format => '%Y')`. These patterns are generated from avenger-sql's `string-arguments.json`, which lists each argument of a chart function or constructor whose strings are markup or a format pattern, by the names that a script writes. A constructor whose name has several meanings, as the plot's `title`, whose first argument is markup, and the tooltip's, whose first argument is a column, matches only as the value of the arguments that take it, and a title whose `syntax` is one that the file lists as plain, `'plain'` or `'plain_lines'`, in any quotes, is no markup. A string of markup that isn't raw and holds an escaped backslash, `\\`, takes no injection: the injected text leaves out a string's escape sequences, so Typst would read the character after the backslash as syntax, as `*` in `'\\*a\\*'`. An injection sees only syntax, so a title whose syntax is a variable keeps its markup, and a `syntax => 'plain'` in a comment of the argument list leaves the title plain. When the file changes in avenger, the patterns follow it:

```sh
node scripts/sync_injections.mjs --avenger-root PATH
```

CI checks them with `--check` against a pinned revision of avenger, as it checks the keywords. `tests/injections.rs` checks the languages that the strings of a list of charts take, and that every generated pattern matches in one of them.

Two parts of `highlights.scm` are generated from `src/node-types.json`: the keywords, and the pattern of a column for each type of node that holds an expression. A grammar change that adds a keyword or a place of an expression updates them:

```sh
node scripts/sync_queries.mjs
```

`npm run check-generated` checks them with `--check`. The Rust binding exports the queries as `HIGHLIGHTS_QUERY` and `INJECTIONS_QUERY`.

## The format and datetime grammars

`format/` holds a second grammar, `avenger_format`, of GoogleSQL's format strings: the elements of `FORMAT_DATE` and its kin, such as `%Y-%m-%d` and `%E4Y`, and the specifiers of `FORMAT`, such as `%'.2f`, which the number patterns of avenger-sql's charts take too. A format is text, `%%`, and directives: `%`, flags, a width, a precision, an `E` or `O` modifier, and a letter. One token reads the directives of both syntaxes, since which syntax a chart's pattern has depends on the type of its value, and the grammar accepts every letter: avenger's formatters decide which directives are valid. `format/queries/highlights.scm` gives a directive `@string.special` and `%%` `@string.escape`, and text keeps the color of its string.

`datetime/` holds a third grammar, `avenger_datetime`, of the values of GoogleSQL's date, time, and range literals, from the canonical formats of GoogleSQL's `docs/data-types.md`: a date, `YYYY-[M]M-[D]D`, a time, `[H]H:[M]M:[S]S[.F]`, a date and a time after a space, `T`, or `t`, with a time zone after the time (an offset such as `-08` or `+05:30`, `Z`, or, after a space, a name such as `America/Los_Angeles`), and a range, `[lower, upper)`, whose bounds are datetimes, `UNBOUNDED`, or `NULL`. One grammar reads the values of every keyword, and avenger-sql's analysis decides whether a value is valid for its type. `datetime/queries/highlights.scm` gives the digits `@number`, the separators `@punctuation.delimiter`, the separator of a time `@punctuation.special`, an offset's sign `@operator`, a zone `@constant`, and `UNBOUNDED` and `NULL` `@constant.builtin`. A value that isn't a date, such as `'soon'`, is an error, which leaves it in the color of `highlights.scm`.

Each grammar has its own `tree-sitter.json`, because the Tree-sitter CLI's `test` doesn't keep two grammars of one configuration apart. The Rust binding exports them as `FORMAT_LANGUAGE` and `DATETIME_LANGUAGE`, with their node types and highlights queries, and an editor builds each from its directory, as Zed's `path` of a grammar does.

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

`npm test` runs the corpus in `test/corpus/` and those of the format and datetime grammars in `format/test/corpus/` and `datetime/test/corpus/`, including `recovery.txt`, which records how the parser recovers from the unfinished text of typing, and the highlight fixtures in `test/highlight/`, whose assertion comments, such as `-- ^ keyword`, give the capture under the caret. `npm run test:scanner` runs the scanner under the address and undefined-behavior sanitizers. `npm run measure -- --write` records the parser's size in `test/metrics/current.json`, which CI compares.

Rust:

```sh
cargo test --release
```

`tests/queries.rs` runs both queries over the highlight fixtures and writes their captures to `tests/output/`. It checks that no node or range has two highlight captures, that every pattern captures in a fixture, and that every capture name is one that Zed's themes and q2's palette show. The strings that the fixtures inject into the format and datetime grammars parse in them without errors, and every pattern of each one's query captures in them. A change of the captures is accepted by copying the output over `tests/baselines/`.
