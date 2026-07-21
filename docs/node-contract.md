# Public node contract

`src/node-types.json` is the machine-readable authority for this contract. This
summary identifies the nodes and fields that downstream queries should prefer.
Anonymous punctuation and keyword spelling remain visible in the concrete tree,
but consumers should not infer schemas or semantic validity from syntax nodes.

## Entry and query nodes

| Node | Stable fields | Role |
| --- | --- | --- |
| `source_file` | `query`, `expression` | Exactly one standalone root role; optional final semicolon is not inherited by reusable rules. |
| `query` | `body` | Optional `with_clause` plus one read-query body. |
| `select_query` | `from` | Preserves standard or `FROM`-first child order; `from` has the same semantic field in both. |
| `select_clause` | `projection` | Projection owner in either source ordering. |
| `projection` | — | Ordered `select_item` children. |
| `select_item` | `value`, `alias` | Expression/wildcard and optional alias. |
| `from_clause` | repeated `relation` | Authored relations and `join_clause` children. |
| `relation` | `value`, `alias` | Table, function, subquery, or `$binding` relation. |
| `relation_alias` / `alias` | `name` | Unquoted or double-quoted alias. |
| `join_clause` | `relation`, `predicate` | Join relation plus optional `ON` predicate; `USING` names remain children. |
| `where_clause` / `having_clause` | `predicate` | Predicate role. |
| `group_by_clause` | — | Ordered grouping expressions. |
| `order_target` | `value` | Ordering expression with optional direction/null placement children. |
| `limit_clause` / `offset_clause` | `value` | Limit/offset expression. |
| `common_table_expression` | `name`, `query` | Read-only CTE definition. |
| `set_operation` | — | Wrapper around `union_except_operation` or `intersect_operation`. |
| `union_except_operation` / `intersect_operation` | repeated `left`, `operator`, `right` | Explicit precedence structure; intersection is nested inside union/except operands. |
| `values_query` / `values_row` | — | Top-level or relation-position values. |

## Expression nodes

| Family | Stable fields |
| --- | --- |
| `qualified_name` | `name`, repeated `member` |
| `function_call` | `function`; arguments/filter/window are named children |
| `function_argument` | optional `name`, `value` |
| `unary_expression` | `operator`, `operand` |
| `binary_expression` | `left`, `operator`, `right` |
| `between_expression` | `value`, `lower`, `upper` |
| `in_expression` | `value` |
| `is_expression` | `value`, `test`, optional `other` |
| `cast_expression` / `postfix_cast_expression` | `value`, `type` |
| `case_expression` | optional `operand`, repeated `condition`/`result`, optional `else` |
| `json_access_expression` | `value`, repeated `member` |
| `subscript_expression` | `value`, optional `index` or `lower`/`upper` |
| `struct_field` | `name`, `value` |
| `subquery_expression` / `subquery_relation` | named `query` descendant |
| `filter_clause` | `predicate` |
| `order_target` | `value` |

Arrays, structs, literals, intervals, windows, and parentheses have dedicated
named nodes even when no field is needed. Function names remain generic; the
grammar never contains a built-in function inventory.

## Bindings and lexical nodes

`binding_reference` has a `root`, repeated `member`, and optional `temporal`
field. `temporal_qualifier` contains the adjacent `@start` or `@previous`
spelling. The grammar deliberately does not decide whether a binding names a
param or store, nor whether a temporal qualifier is legal in a semantic context.

Stable lexical nodes distinguish `identifier`, `quoted_identifier`, `number`,
`single_quoted_string`, `escaped_string`, `dollar_quoted_string`,
`hex_binary_literal`, `line_comment`, and `block_comment`. Signs are unary
operators rather than part of `number`.

## Recovery and compatibility

Tree-sitter may add `ERROR`, `MISSING`, or alternate recovery structure while a
user edits incomplete input. Tooling should anchor to the nearest stable named
ancestor and avoid depending on exact error-node shape unless a reviewed corpus
case explicitly baselines it.

Before 1.0, changing a named node or field requires regenerated
`src/node-types.json`, reviewed corpus/highlight changes, an updated version,
and the downstream composition smoke suite. Patch releases must preserve this
contract.
