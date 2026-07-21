# tree-sitter-avenger-sql

`tree-sitter-avenger-sql` is the reusable Tree-sitter base grammar for
Avenger's read-only SQL queries and scalar expressions. It supports standard
and `FROM`-first queries, DataFusion-oriented expressions, `$binding.path`
references, temporal qualifiers such as `@start`, and Avenger's shared lexical
contract.

This is a tolerant editor parser, not the language validator. A clean syntax
tree does not prove that a query resolves, type-checks, or is supported by
DataFusion. `AvengerSqlDialect`, the Avenger compiler, and DataFusion planning
remain authoritative.

The grammar is an aggressively trimmed, attributed fork of
`DerekStride/tree-sitter-sql`. See [UPSTREAM.md](UPSTREAM.md) for the immutable
base revision, measurements, pruning inventory, and selective-rebase policy.

## Scope

The standalone root parses exactly one query or scalar expression, with an
optional final semicolon. Reusable `_query` and `_expression` rules deliberately
exclude that terminator so `tree-sitter-avenger` can inherit them at DSL island
boundaries.

Supported syntax includes:

- read-only `SELECT`, `WITH`, `VALUES`, and set queries;
- standard `SELECT ... FROM ...` and `FROM ... SELECT ...` source order;
- relations, aliases, joins, filters, grouping, windows, ordering, and limits;
- literals, calls, casts, arrays, structs, subqueries, predicates, and operators;
- `$binding.path`, adjacent `@start`/`@previous`, JSON access, and store relations.

DDL, writes, transactions, administration, procedures, and general vendor SQL
are intentionally absent. Unsupported input still produces a useful recovery
tree for editors.

## Examples

```sql
FROM vega.movies AS m
SELECT m."title", CAST(m."rating" AS DOUBLE)
WHERE m."rating" >= $minimum
```

```sql
$config@previous:theme.color
```

## Development

Tree-sitter CLI 0.26.3 is pinned in `package-lock.json`.

```sh
npm ci
npm run generate
npm test
npm run test:highlights
npm run test:scanner
npm run check-generated
npm run build:wasm
npm run measure -- --check
cargo test --locked --release
```

To check the synchronized compiler-owned conformance manifest against a local
Avenger checkout:

```sh
npm run sync-conformance -- \
  --avenger-root /path/to/avenger \
  --check
```

Generated `src/parser.c`, `src/grammar.json`, `src/node-types.json`, and parser
headers are committed. Never hand-edit them or accept corpus updates without
reviewing each changed S-expression.

See [docs/node-contract.md](docs/node-contract.md) for the stable named nodes,
fields, recovery guidance, and pre-1.0 compatibility policy.

## Using the grammar as a base

The package's default export is the normal Tree-sitter grammar object:

```js
import AvengerSql from "@avenger-vis/tree-sitter-avenger-sql";

export default grammar(AvengerSql, {
  name: "derived_language",
  rules: {
    source_file: $ => $.query_wrapper,
    query_wrapper: $ => seq("query", "{", $._query, "}"),
  },
});
```

Consumers must pin an immutable revision. If a derived grammar needs a physical
scanner or highlight copy, it must synchronize that file with revision and hash
metadata rather than using an undeclared sibling path.

## Compatibility

Before 1.0, named nodes and fields may change when the Avenger language contract
changes. Such changes require reviewed corpus updates, regenerated
`node-types.json`, and downstream composition verification. Patch releases must
not silently change the public node contract.
