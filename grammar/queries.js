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
    field("name", $.identifier),
    optional(seq("(", commaSep1($.identifier), ")")),
    $.keyword_as,
    optional(seq(optional($.keyword_not), $.keyword_materialized)),
    "(",
    field("query", $._query),
    ")",
  ),

  set_operation: $ => prec.left(seq(
    field("left", $._query_primary),
    repeat1(seq(
      field("operator", choice(
        seq($.keyword_union, optional($.keyword_all)),
        $.keyword_intersect,
        $.keyword_except,
      )),
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

  wildcard: $ => seq(
    optional(seq($.qualified_name, ".")),
    "*",
  ),

  alias: $ => seq(optional($.keyword_as), field("name", $.identifier)),

  from_clause: $ => seq(
    $.keyword_from,
    field("relation", $.relation),
    repeat(choice(
      seq(",", field("relation", $.relation)),
      $.join_clause,
    )),
  ),

  relation: $ => prec.right(seq(
    field("value", choice(
      $.binding_reference,
      $.function_call,
      $.qualified_name,
      $.subquery_relation,
    )),
    optional(field("alias", $.relation_alias)),
  )),

  relation_alias: $ => seq(
    optional($.keyword_as),
    field("name", $.identifier),
    optional(seq("(", commaSep1($.identifier), ")")),
  ),

  subquery_relation: $ => seq("(", $._query, ")"),

  join_clause: $ => seq(
    optional(choice(
      $.keyword_natural,
      $.keyword_cross,
      $.keyword_inner,
      $.keyword_left,
      seq($.keyword_left, optional($.keyword_outer)),
      $.keyword_right,
      seq($.keyword_right, optional($.keyword_outer)),
      $.keyword_full,
      seq($.keyword_full, optional($.keyword_outer)),
    )),
    $.keyword_join,
    optional($.keyword_lateral),
    field("relation", $.relation),
    optional(choice(
      seq($.keyword_on, field("predicate", $._expression)),
      seq($.keyword_using, "(", commaSep1($.identifier), ")"),
    )),
  ),

  where_clause: $ => seq($.keyword_where, field("predicate", $._expression)),

  group_by_clause: $ => seq($.keyword_group, $.keyword_by, commaSep1($._expression)),

  having_clause: $ => seq($.keyword_having, field("predicate", $._expression)),

  named_window_clause: $ => seq(
    $.keyword_window,
    field("name", $.identifier),
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
