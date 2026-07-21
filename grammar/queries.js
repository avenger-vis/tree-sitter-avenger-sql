import { commaSep, commaSep1 } from "./helpers.js";

export default {
  _query: $ => $.query,

  query: $ => seq(
    optional($.with_clause),
    field("body", $._query_body),
  ),

  _query_body: $ => choice(
    $.set_operation,
    $.select_query,
    $.values_query,
  ),

  with_clause: $ => seq(
    $.keyword_with,
    optional($.keyword_recursive),
    commaSep1($.common_table_expression),
  ),

  common_table_expression: $ => seq(
    field("name", choice($.identifier, $.quoted_identifier)),
    optional(seq("(", commaSep1(choice($.identifier, $.quoted_identifier)), ")")),
    $.keyword_as,
    optional(seq(optional($.keyword_not), $.keyword_materialized)),
    "(",
    field("query", $._query),
    ")",
  ),

  set_operation: $ => choice(
    $.union_except_operation,
    $.intersect_operation,
  ),

  union_except_operation: $ => prec.left(1, seq(
    field("left", $._union_operand),
    repeat1(seq(
      field("operator", choice(
        seq($.keyword_union, optional($.keyword_all)),
        $.keyword_except,
      )),
      field("right", $._union_operand),
    )),
  )),

  _union_operand: $ => choice(
    $.intersect_operation,
    $._query_primary,
  ),

  intersect_operation: $ => prec.left(2, seq(
    field("left", $._query_primary),
    repeat1(seq(
      field("operator", $.keyword_intersect),
      field("right", $._query_primary),
    )),
  )),

  _query_primary: $ => choice(
    $.select_query,
    $.values_query,
    seq("(", $._query, ")"),
  ),

  select_query: $ => choice(
    seq(
      $.select_clause,
      optional(field("from", $.from_clause)),
      optional($.where_clause),
      optional($.group_by_clause),
      optional($.having_clause),
      repeat($.named_window_clause),
      optional($.order_by_clause),
      optional($.limit_clause),
      optional($.offset_clause),
    ),
    seq(
      field("from", $.from_clause),
      $.select_clause,
      optional($.where_clause),
      optional($.group_by_clause),
      optional($.having_clause),
      repeat($.named_window_clause),
      optional($.order_by_clause),
      optional($.limit_clause),
      optional($.offset_clause),
    ),
  ),

  select_clause: $ => seq(
    $.keyword_select,
    optional($.keyword_distinct),
    field("projection", $.projection),
  ),

  projection: $ => commaSep1($.select_item),

  select_item: $ => seq(
    field("value", choice($.wildcard, $._expression)),
    optional(field("alias", $.alias)),
  ),

  wildcard: $ => prec.right(20, seq(
    optional(seq(
      field("qualifier", $.name),
      repeat(seq(".", field("qualifier", $.name))),
      ".",
    )),
    "*",
  )),

  alias: $ => seq(
    optional($.keyword_as),
    field("name", choice($.identifier, $.quoted_identifier)),
  ),

  where_clause: $ => seq($.keyword_where, field("predicate", $._expression)),

  group_by_clause: $ => seq($.keyword_group, $.keyword_by, commaSep1($._expression)),

  having_clause: $ => seq($.keyword_having, field("predicate", $._expression)),

  named_window_clause: $ => seq(
    $.keyword_window,
    field("name", choice($.identifier, $.quoted_identifier)),
    $.keyword_as,
    $.window_specification,
  ),

  order_by_clause: $ => seq(
    $.keyword_order,
    $.keyword_by,
    commaSep1($.order_target),
  ),

  order_target: $ => seq(
    field("value", $._expression),
    optional(choice($.keyword_asc, $.keyword_desc)),
    optional(seq($.keyword_nulls, choice($.keyword_first, $.keyword_last))),
  ),

  limit_clause: $ => seq($.keyword_limit, field("value", $._expression)),

  offset_clause: $ => seq($.keyword_offset, field("value", $._expression)),

  values_query: $ => seq(
    $.keyword_values,
    commaSep1($.values_row),
  ),

  values_row: $ => seq("(", commaSep($._expression), ")"),
};
