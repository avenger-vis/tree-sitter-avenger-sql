// The sources of a `FROM` clause and of a pipe `JOIN`: tables, queries in parentheses, `UNNEST`,
// table function calls, joins, and the clauses that follow a source.

import { commaSep, commaSep1, kw, kwAsName } from "./helpers.js";

// The levels of the source forms: a join binds loosest, and the clauses that follow a source,
// such as `PIVOT`, bind to the source just before them.
const PREC = { join: 1, clause: 2 };

export default {
  _source: $ =>
    choice(
      $.table_source,
      $.subquery_source,
      $.unnest_source,
      $.tvf_source,
      $.paren_join,
      $.join,
      $.pivot_source,
      $.unpivot_source,
      $.sample_source,
      $.match_recognize_source,
    ),

  // A table: `[LATERAL] path [[AS] alias] [WITH OFFSET [[AS] alias]]`. avenger-sql-syntax checks
  // that `LATERAL` precedes a query or a table function call.
  table_source: $ =>
    seq(optional(kw("LATERAL")), alias($._table_path, $.path), optional($._source_alias), optional($.with_offset)),

  // `[LATERAL] (query) [[AS] alias]`
  subquery_source: $ => seq(optional(kw("LATERAL")), $.paren_query, optional($._source_alias)),

  // `UNNEST(arrays [, mode => value]) [[AS] alias] [WITH OFFSET [[AS] alias]]`
  unnest_source: $ =>
    seq(
      kw("UNNEST"),
      "(",
      commaSep(choice($.aliased_expr, $.named_arg)),
      ")",
      optional($._source_alias),
      optional($.with_offset),
    ),

  // A table function call: `[LATERAL] path(arguments) [[AS] alias]`. A table followed by `(` is
  // always a call, as in avenger-sql-syntax, not a table and a statement in parentheses after it.
  tvf_source: $ =>
    prec(
      PREC.clause,
      seq(optional(kw("LATERAL")), alias($._table_path, $.path), $.arg_list, optional($._source_alias)),
    ),

  // `(join)`: a join in parentheses.
  paren_join: $ => seq("(", $.join, ")"),

  // `source join_op source [condition]`, or `source, source`. Joins and commas associate to the
  // left, as in GoogleSQL, so `a, b JOIN c` joins `c` to the cross join of `a` and `b`.
  join: $ =>
    prec.left(
      PREC.join,
      seq(field("lhs", $._source), $.join_op, field("rhs", $._source), optional($._join_condition)),
    ),

  // `[NATURAL] [INNER | CROSS | {LEFT | RIGHT | FULL} [OUTER]] JOIN`, or `,`. A comma before a
  // source is a join, as in avenger-sql-syntax, not a trailing comma of `FROM` before a statement
  // in parentheses.
  join_op: $ =>
    choice(
      seq(
        optional(kw("NATURAL")),
        optional(choice(kw("INNER"), kw("CROSS"), seq(choice(kw("LEFT"), kw("RIGHT"), kw("FULL")), optional(kw("OUTER"))))),
        kw("JOIN"),
      ),
      prec(PREC.clause, ","),
    ),

  _join_condition: $ => choice($.on_condition, $.using_condition),

  // `ON condition`
  on_condition: $ => seq(kw("ON"), $._expr),

  // `USING (columns)`
  using_condition: $ => seq(kw("USING"), $.name_list),

  // `WITH OFFSET [[AS] alias]`
  with_offset: $ => seq(kw("WITH"), kw("OFFSET"), optional($.alias)),

  // The alias of a source. `PIVOT` and `UNPIVOT` start a clause when `(` or `INCLUDE` or
  // `EXCLUDE` follows them, and are an alias otherwise.
  _source_alias: $ => choice($.alias, alias($._clause_word_alias, $.alias)),
  _clause_word_alias: $ => alias($._clause_word, $.name),
  _clause_word: $ => choice(kwAsName($, "PIVOT"), kwAsName($, "UNPIVOT")),

  // A source and its `PIVOT`, `UNPIVOT`, `TABLESAMPLE`, or `MATCH_RECOGNIZE`.
  pivot_source: $ => prec.left(PREC.clause, seq($._source, $.pivot_clause)),
  unpivot_source: $ => prec.left(PREC.clause, seq($._source, $.unpivot_clause)),
  sample_source: $ => prec.left(PREC.clause, seq($._source, $.sample_clause)),
  match_recognize_source: $ => prec.left(PREC.clause, seq($._source, $.match_recognize_clause)),

  // `TABLESAMPLE method (size {ROWS | PERCENT} [PARTITION BY ...]) [REPEATABLE (seed)]
  // [WITH WEIGHT [[AS] alias] [REPEATABLE (seed)]]`
  sample_clause: $ =>
    seq(
      kw("TABLESAMPLE"),
      field("method", $.name_ref),
      "(",
      $.sample_size,
      ")",
      optional(choice($.repeatable, seq($.weight, optional($.repeatable)))),
    ),

  // `size {ROWS | PERCENT} [PARTITION BY expressions]`
  sample_size: $ => seq($._expr, choice(kw("ROWS"), kw("PERCENT")), optional($.partition_by)),

  // `REPEATABLE (seed)`
  repeatable: $ => seq(kw("REPEATABLE"), "(", $._expr, ")"),

  // `WITH WEIGHT [[AS] alias]`
  weight: $ => seq(kw("WITH"), kw("WEIGHT"), optional($.alias)),

  // `PIVOT (aggregates FOR column IN (values)) [[AS] alias]`. The column binds tighter than the
  // `IN` after it.
  pivot_clause: $ =>
    seq(
      kw("PIVOT"),
      "(",
      commaSep1($.aliased_expr),
      kw("FOR"),
      field("column", $._pivot_column),
      kw("IN"),
      $.pivot_values,
      ")",
      optional($.alias),
    ),
  _pivot_column: $ => prec.left(4, $._expr),

  // `(value [[AS] alias], ...)` of a `PIVOT`.
  pivot_values: $ => seq("(", commaSep1($.aliased_expr), ")"),

  // `UNPIVOT [{INCLUDE | EXCLUDE} NULLS] (values FOR name IN (columns)) [[AS] alias]`
  unpivot_clause: $ =>
    seq(
      kw("UNPIVOT"),
      optional(seq(choice(kw("INCLUDE"), kw("EXCLUDE")), kw("NULLS"))),
      "(",
      $.path_list,
      kw("FOR"),
      $.path,
      kw("IN"),
      "(",
      commaSep1($.unpivot_item),
      ")",
      ")",
      optional($.alias),
    ),

  // The columns of an `UNPIVOT`, and their label: `columns [[AS] label]`, where a label is a
  // string or an integer.
  unpivot_item: $ => seq($.path_list, optional(seq(optional(kw("AS")), $.literal))),

  // A path, or paths in parentheses, of an `UNPIVOT`.
  path_list: $ => choice($.path, seq("(", commaSep1($.path), ")")),

  // `(name, ...)`
  name_list: $ => seq("(", commaSep($.name_ref), ")"),

  // A table's path, whose first name can hold single dashes without spaces, as in
  // `my-project.dataset.table`. A part after a dash is a name or a number, and in
  // `my-project-2.dataset` the float `2.` ends the first name, so the next name follows it with
  // no dot. avenger-sql-syntax reports a reserved word after a dash.
  _table_path: $ =>
    choice(
      $._path_body,
      seq(alias($._dashed_name, $.name_ref), optional($._path_names)),
      seq(alias($._dashed_name_dot, $.name_ref), alias($._adjacent_name, $.name_ref), optional($._path_names)),
    ),
  _path_body: $ => seq($.name_ref, optional($._path_names)),
  _dashed_name: $ => seq($.identifier, repeat1(seq(token.immediate("-"), $._dash_part))),
  _dashed_name_dot: $ =>
    seq(
      $.identifier,
      repeat(seq(token.immediate("-"), $._dash_part)),
      token.immediate("-"),
      alias(token.immediate(/[0-9]+\./), $.float),
    ),
  _dash_part: $ =>
    choice(
      alias(token.immediate(/[A-Za-z_][A-Za-z0-9_]*/), $.identifier),
      alias(token.immediate(/[0-9]+/), $.integer),
    ),
  _adjacent_name: $ => alias(token.immediate(/[A-Za-z_][A-Za-z0-9_]*/), $.identifier),
};
