# Upstream provenance

`tree-sitter-avenger-sql` preserves the Git ancestry and MIT license of
[`DerekStride/tree-sitter-sql`](https://github.com/DerekStride/tree-sitter-sql).
It is intentionally a narrow Avenger/DataFusion editor grammar, not a general
SQL distribution.

## Pinned base

| Field | Value |
| --- | --- |
| Upstream repository | `https://github.com/DerekStride/tree-sitter-sql.git` |
| Commit | `c2e1e08db1ea20dc23bdb8d228a81a8756e9c450` |
| Commit date | 2026-03-02 |
| Upstream package | `@derekstride/tree-sitter-sql` 0.3.11 |
| License | MIT |
| Upstream Tree-sitter CLI | 0.26.3 |
| Local immutable tag | `upstream/0.3.11-avenger-base` |

The `upstream` remote is fetch-only. Builds and tests pin commits and never
track an upstream branch.

## Selection rationale

The DerekStride grammar was selected because it is maintained, modular,
MIT-licensed, exposes an expression rule, and is the lineage of the historical
Avenger grammar. It was preferred over:

- the historical embedded Avenger SQL subset, which is compact but obsolete;
- PostgreSQL- and BigQuery-specific forks, whose dialects and monolithic rule
  graphs are a worse fit;
- a greenfield grammar, which would unnecessarily recreate mature expression,
  precedence, select, relation, and recovery structure.

The full upstream grammar is not suitable for Avenger. At the pinned revision,
generation with Tree-sitter CLI 0.26.3 produced 30,622 states and a 41,602,006
byte `parser.c`, largely for DDL, writes, transactions, procedures, utilities,
and vendor syntax outside Avenger's read-query/expression language. This fork
therefore removes those families physically rather than leaving them dormant.

## Initial disposition

| Upstream area | Disposition | Avenger action |
| --- | --- | --- |
| `grammar.js` | replace | one query/expression root, Avenger name/extras/externals/conflicts |
| `grammar/expressions.js` | adapt heavily | retain useful expression structure; replace lexical forms, parameters, operators, types, and vendor expressions |
| `grammar/statements/select.js` | adapt heavily and split | retain read-query/relation/window structure; remove `INTO`, hints, vendor clauses, and write paths; add `FROM`-first |
| `grammar/helpers.js` | retain selectively | keep reviewed list/parenthesis helpers |
| `grammar/column-lists.js` | remove | no retained read rule reaches its DDL-oriented helpers |
| `grammar/types.js` | replace | narrow to DataFusion cast types used by the executable corpus |
| `grammar/keywords.js` | replace/narrow | keep only the transitive closure of retained query/expression rules |
| `grammar/transactions.js` | remove | transactions are outside Avenger SQL |
| `grammar/statements/index.js` | replace | remove the broad statement dispatcher |
| `alter.js` | remove | DDL |
| `comment.js` | remove | DDL/comment-on |
| `copy.js` | remove | transfer/write |
| `create-function.js` | remove | procedural DDL |
| `create-procedure.js` | remove | procedural DDL |
| `create.js` | remove | DDL |
| `delete.js` | remove | write |
| `drop.js` | remove | DDL |
| `insert.js` | remove | write |
| `merge.js` | remove | write |
| `optimize.js` | remove | administration |
| `refresh.js` | remove | administration |
| `rename.js` | remove | DDL |
| `set.js` | remove | session/utility |
| `truncate.js` | remove | write/DDL |
| `update.js` | remove | write |
| `src/scanner.c` | replace | upstream allocation, tag, whitespace, state, and recovery behavior does not match Avenger |
| `queries/highlights.scm` | adapt after node freeze | retain only reviewed captures over reachable nodes |
| `queries/indents.scm` | remove initially | structural indentation belongs to the derived Avenger grammar |
| C binding | retain and rename | parser consumption |
| Rust binding | retain, rename, minimize | incremental/scanner tests |
| Node native binding/prebuilds | remove | JavaScript grammar composition does not require a native addon |
| Go/Python/Swift bindings | remove initially | no initial consumer requirement |
| docs site/release tooling | replace | focused README, CI, provenance, and pre-1.0 release process |

Rule-level refinements are recorded in this table as implementation proceeds.
A removed family must not survive as an import, unreachable choice, keyword,
conflict, external token, scanner branch, capture, test, or generated node.

## Baseline and toolchain record

All measurements below were taken on macOS arm64 with Tree-sitter CLI 0.26.3
(ABI 15). The upstream parser generated in 92.13 seconds, passed its own corpus,
and built to Wasm successfully. Its generated shape was 30,622 states, 5,243
large states, 770 symbols, 429 tokens, 53 fields, and a 41,602,006-byte
`parser.c`. The only generation warning was an unnecessary conflict between
`field` and `_qualified_field`.

The historical combined `tree-sitter-avenger` parser at
`2661a76a1796b34b0c16afb5fed35cc81e45b807` used ABI 15, 4,686 states, 16
large states, 346 symbols, 196 tokens, 88 fields, and a 4,750,682-byte
`parser.c`. Machine-readable upstream and current records live in
`test/metrics/`.

The initial package surface is JavaScript grammar composition, committed C
sources/header, a minimal Rust binding and test harness, and a Wasm build check.
The grammar does not ship native Node, Go, Python, or Swift bindings.

## Rebase policy

Upstream updates are reviewed selectively:

1. fetch an immutable upstream commit;
2. inspect changes only in retained/adapted areas;
3. port relevant fixes as focused commits, preserving attribution;
4. rerun the Avenger compiler-manifest, corpus, incremental, scanner, Wasm,
   highlight, generated-drift, composition, and metric suites;
5. update the pinned commit and disposition notes only after review.

Never merge a new statement family merely because it was added upstream.
