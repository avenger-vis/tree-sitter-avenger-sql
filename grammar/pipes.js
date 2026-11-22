// Pipe operators.

import { commaSep, commaSep1, kw } from "./helpers.js";

// A pipe operator: `|>` and its parts. Statements need no `;` between them, so a statement in
// parentheses could follow an operator that ends in a list or an expression; as in
// avenger-sql-syntax, `(` there continues the operator, as an item after a trailing comma, a call,
// or a value, so every operator is right-associative.
const pipe = (...parts) => prec.right(seq("|>", ...parts));

export default {
  _pipe_operator: $ =>
    choice(
      $.pipe_select,
      $.pipe_extend,
      $.pipe_set,
      $.pipe_drop,
      $.pipe_rename,
      $.pipe_as,
      $.pipe_where,
      $.pipe_aggregate,
      $.pipe_distinct,
      $.pipe_order_by,
      $.pipe_limit,
      $.pipe_set_operation,
      $.pipe_join,
      $.pipe_call,
      $.pipe_sample,
      $.pipe_with,
      $.pipe_pivot,
      $.pipe_unpivot,
      $.pipe_match_recognize,
    ),

  // `|> SELECT [DISTINCT | ALL] items [WINDOW ...]`
  pipe_select: $ =>
    pipe(
      kw("SELECT"),
      optional(choice(kw("DISTINCT"), kw("ALL"))),
      optional($.select_as),
      commaSep1($._select_entry),
      optional($.window_clause),
    ),

  // `AS STRUCT` or `AS VALUE`, which make the rows a value table.
  select_as: $ => seq(kw("AS"), choice(kw("STRUCT"), kw("VALUE"))),

  // `|> EXTEND items [WINDOW ...]`
  pipe_extend: $ => pipe(kw("EXTEND"), commaSep1($._select_entry), optional($.window_clause)),

  // `|> SET column = value, ...`
  pipe_set: $ => pipe(kw("SET"), commaSep1($.assignment)),

  // `|> DROP columns`
  pipe_drop: $ => pipe(kw("DROP"), commaSep1($.name_ref)),

  // `|> RENAME column [AS] name, ...`
  pipe_rename: $ => pipe(kw("RENAME"), commaSep1($.rename_item)),

  // `|> AS alias`
  pipe_as: $ => pipe(kw("AS"), $.name),

  // `|> WHERE condition`
  pipe_where: $ => pipe(kw("WHERE"), field("condition", $._expr)),

  // `|> AGGREGATE [items] [GROUP [AND ORDER] BY items]`
  pipe_aggregate: $ => pipe(kw("AGGREGATE"), commaSep($.aggregate_item), optional($.group_by)),

  // `|> DISTINCT`
  pipe_distinct: $ => pipe(kw("DISTINCT")),

  // `|> ORDER BY keys`
  pipe_order_by: $ => pipe($.order_by),

  // `|> LIMIT count [OFFSET skip]`
  pipe_limit: $ => pipe(kw("LIMIT"), field("count", $._expr), optional($.limit_offset)),

  // `|> [mode] {UNION | INTERSECT | EXCEPT} {ALL | DISTINCT} [BY NAME | CORRESPONDING] (query), ...`
  pipe_set_operation: $ =>
    pipe(
      optional($.set_op_mode),
      choice(kw("UNION"), kw("INTERSECT"), kw("EXCEPT")),
      choice(kw("ALL"), kw("DISTINCT")),
      optional(choice($.by_name, $.corresponding)),
      commaSep1($.paren_query),
    ),

  // `|> join_op source [condition]`
  pipe_join: $ => pipe($.join_op, $._source, optional($._join_condition)),

  // `|> CALL path(arguments) [[AS] alias]`
  pipe_call: $ => pipe(kw("CALL"), $.path, $.arg_list, optional($.alias)),

  // `|> TABLESAMPLE ...`
  pipe_sample: $ => pipe($.sample_clause),

  // `|> WITH name AS (query), ...`
  pipe_with: $ => pipe(kw("WITH"), commaSep1($.named_query)),

  // `|> PIVOT (...)`, `|> UNPIVOT (...)`, `|> MATCH_RECOGNIZE (...)`
  pipe_pivot: $ => pipe($.pivot_clause),
  pipe_unpivot: $ => pipe($.unpivot_clause),
  pipe_match_recognize: $ => pipe($.match_recognize_clause),

  _select_entry: $ => choice($.select_item, $.wildcard),

  // `expression [[AS] alias]`
  select_item: $ => seq($._expr, optional($.alias)),

  // `[path.]* [EXCEPT (columns)] [REPLACE (expression AS name, ...)]`, or `expression.*` of a
  // struct. `.*` is one token, because one token of lookahead after a path can't tell the `.` of
  // a field from the `.` of `.*`.
  wildcard: $ =>
    seq(
      choice("*", seq(choice($.path, $._field_base), ".*")),
      optional($.except_list),
      optional($.replace_list),
    ),

  // `EXCEPT (columns)`
  except_list: $ => seq(kw("EXCEPT"), $.name_list),

  // `REPLACE (expression AS name, ...)`
  replace_list: $ => seq(kw("REPLACE"), "(", commaSep1($.replace_item), ")"),

  // `expression AS name`
  replace_item: $ => seq($._expr, kw("AS"), $.name),

  // `WINDOW name AS window, ...`
  // Right-associative, as the pipe operators are, since it can end one.
  window_clause: $ => prec.right(seq(kw("WINDOW"), commaSep1($.named_window))),

  // `name AS window`
  named_window: $ => seq($.name, kw("AS"), choice($.name_ref, $.window_spec)),

  // `column = value`
  assignment: $ => seq($.name_ref, "=", $._expr),

  // `column [AS] name`
  rename_item: $ => seq($.name_ref, optional(kw("AS")), $.name),

  // `expression [[AS] alias] [{ASC | DESC} [NULLS {FIRST | LAST}]]`, or `expression.*` of a
  // struct, which takes no alias or order, and whose wildcard starts at `.*`.
  aggregate_item: $ =>
    seq($._expr, choice(seq(optional($.alias), optional($.order_suffix)), alias($._item_wildcard, $.wildcard))),
  _item_wildcard: $ => seq(".*", optional($.except_list), optional($.replace_list)),

  // `{ASC | DESC} [NULLS {FIRST | LAST}]`, or for a group item `NULLS {FIRST | LAST}` alone.
  order_suffix: $ =>
    choice(
      seq(choice(kw("ASC"), kw("DESC")), optional(seq(kw("NULLS"), choice(kw("FIRST"), kw("LAST"))))),
      seq(kw("NULLS"), choice(kw("FIRST"), kw("LAST"))),
    ),

  // `GROUP [AND ORDER] BY items`
  // Right-associative, as the pipe operators are, since it can end one.
  group_by: $ =>
    prec.right(seq(kw("GROUP"), optional(seq(kw("AND"), kw("ORDER"))), kw("BY"), commaSep1($._grouping_item))),

  _grouping_item: $ => choice($.group_item, $.grouping_empty, $.rollup, $.cube, $.grouping_sets),

  // `expression [[AS] alias] [{ASC | DESC}] [NULLS {FIRST | LAST}]`
  group_item: $ => seq($._expr, optional($.alias), optional($.order_suffix)),

  // `()`
  grouping_empty: _ => seq("(", ")"),

  // `ROLLUP (expressions)` and `CUBE (expressions)`
  rollup: $ => seq(kw("ROLLUP"), "(", commaSep1($._expr), ")"),
  cube: $ => seq(kw("CUBE"), "(", commaSep1($._expr), ")"),

  // `GROUPING SETS (sets)`
  grouping_sets: $ => seq(kw("GROUPING"), kw("SETS"), "(", commaSep1($._grouping_set), ")"),

  _grouping_set: $ => choice($.grouping_empty, $.rollup, $.cube, $._expr),

  // `OFFSET skip`
  limit_offset: $ => seq(kw("OFFSET"), $._expr),

  // The mode of a set operation: `INNER`, `OUTER`, or `{LEFT | FULL} [OUTER]`.
  set_op_mode: $ => choice(kw("INNER"), kw("OUTER"), seq(choice(kw("LEFT"), kw("FULL")), optional(kw("OUTER")))),

  // `BY NAME [ON (columns)]`
  by_name: $ => seq(kw("BY"), kw("NAME"), optional(seq(kw("ON"), $.name_list))),

  // `[STRICT] CORRESPONDING [BY (columns)]`
  corresponding: $ => seq(optional(kw("STRICT")), kw("CORRESPONDING"), optional(seq(kw("BY"), $.name_list))),

  // `name AS (query)`
  named_query: $ => seq($.name, kw("AS"), $.paren_query),
};
