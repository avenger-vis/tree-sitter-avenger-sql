import { commaSep, commaSep1 } from "./helpers.js";

const PREC = {
  OR: 1,
  AND: 2,
  NOT: 3,
  COMPARE: 4,
  CONTAINS: 5,
  CONCAT: 6,
  BIT_OR: 7,
  BIT_XOR: 8,
  BIT_AND: 9,
  SHIFT: 10,
  ADD: 11,
  MULTIPLY: 12,
  UNARY: 13,
  POSTFIX: 14,
};

export default {
  _expression: $ => choice(
    $._unsupported_unicode_string,
    $._unterminated_quoted_literal,
    $.literal,
    $.binding_reference,
    $.function_call,
    $.case_expression,
    $.cast_expression,
    $.exists_expression,
    $.interval_expression,
    $.typed_string_expression,
    $.array_expression,
    $.struct_expression,
    $.subquery_expression,
    $.parenthesized_expression,
    $.qualified_name,
    $.unary_expression,
    $.binary_expression,
    $.between_expression,
    $.in_expression,
    $.is_expression,
    $.postfix_cast_expression,
    $.json_access_expression,
    $.subscript_expression,
  ),

  binding_reference: $ => seq(
    "$",
    field("root", alias(token.immediate(/[_\p{Alphabetic}][_\p{Alphabetic}0-9]*/), $.identifier)),
    repeat(seq(".", field("member", $.identifier))),
    optional(field("temporal", $.temporal_qualifier)),
  ),

  temporal_qualifier: _ => token.immediate(choice("@start", "@previous")),

  parenthesized_expression: $ => prec(PREC.POSTFIX, seq("(", $._expression, ")")),

  subquery_expression: $ => seq("(", $._query, ")"),

  array_expression: $ => seq("[", commaSep($._expression), "]"),

  struct_expression: $ => seq(
    "{",
    commaSep($.struct_field),
    "}",
  ),

  struct_field: $ => seq(
    field("name", choice($.identifier, $.quoted_identifier, $.single_quoted_string)),
    ":",
    field("value", $._expression),
  ),

  function_call: $ => prec(PREC.POSTFIX, seq(
    field("function", $.qualified_name),
    "(",
    optional($.keyword_distinct),
    commaSep($.function_argument),
    optional($.order_by_clause),
    ")",
    optional($.filter_clause),
    optional($.over_clause),
  )),

  function_argument: $ => choice(
    seq(field("name", $.identifier), choice("=>", ":="), field("value", $._expression)),
    $._expression,
    "*",
  ),

  filter_clause: $ => seq(
    $.keyword_filter,
    "(",
    $.keyword_where,
    field("predicate", $._expression),
    ")",
  ),

  over_clause: $ => seq(
    $.keyword_over,
    choice($.identifier, $.quoted_identifier, $.window_specification),
  ),

  window_specification: $ => seq(
    "(",
    optional($.partition_by_clause),
    optional($.order_by_clause),
    optional($.window_frame),
    ")",
  ),

  partition_by_clause: $ => seq(
    $.keyword_partition,
    $.keyword_by,
    commaSep1($._expression),
  ),

  window_frame: $ => seq(
    choice($.keyword_rows, $.keyword_range, $.keyword_groups),
    choice(
      $.frame_bound,
      seq($.keyword_between, $.frame_bound, $.keyword_and, $.frame_bound),
    ),
    optional(seq(
      $.keyword_exclude,
      choice(
        seq($.keyword_current, $.keyword_row),
        $.keyword_group,
        $.keyword_ties,
        seq($.keyword_no, $.keyword_others),
      ),
    )),
  ),

  frame_bound: $ => choice(
    seq($.keyword_unbounded, choice($.keyword_preceding, $.keyword_following)),
    seq($._expression, choice($.keyword_preceding, $.keyword_following)),
    seq($.keyword_current, $.keyword_row),
  ),

  case_expression: $ => seq(
    $.keyword_case,
    optional(field("operand", $._expression)),
    repeat1(seq(
      $.keyword_when,
      field("condition", $._expression),
      $.keyword_then,
      field("result", $._expression),
    )),
    optional(seq($.keyword_else, field("else", $._expression))),
    $.keyword_end,
  ),

  cast_expression: $ => seq(
    $.keyword_cast,
    "(",
    field("value", $._expression),
    $.keyword_as,
    field("type", $.data_type),
    ")",
  ),

  postfix_cast_expression: $ => prec.left(PREC.POSTFIX, seq(
    field("value", $._expression),
    "::",
    field("type", $.data_type),
  )),

  exists_expression: $ => seq($.keyword_exists, $.subquery_expression),

  interval_expression: $ => prec.right(seq(
    $.keyword_interval,
    choice($.single_quoted_string, $.escaped_string, $.dollar_quoted_string),
    optional($.identifier),
  )),

  typed_string_expression: $ => seq(
    choice($.keyword_date, $.keyword_time, $.keyword_timestamp),
    $.single_quoted_string,
  ),

  unary_expression: $ => choice(
    prec.right(PREC.UNARY, seq(
      field("operator", choice("+", "-", "~", "@")),
      field("operand", $._expression),
    )),
    prec.right(PREC.NOT, seq(
      field("operator", $.keyword_not),
      field("operand", $._expression),
    )),
  ),

  binary_expression: $ => choice(
    binary($, $.keyword_or, PREC.OR),
    binary($, $.keyword_and, PREC.AND),
    binary($, choice("=", "!=", "<>", "<", "<=", ">", ">="), PREC.COMPARE),
    binary($, choice(
      $.keyword_like,
      $.keyword_ilike,
      $.keyword_rlike,
      seq($.keyword_not, choice($.keyword_like, $.keyword_ilike, $.keyword_rlike)),
    ), PREC.COMPARE),
    binary($, choice("@>", "<@", "->", "->>"), PREC.CONTAINS),
    binary($, "||", PREC.CONCAT),
    binary($, "|", PREC.BIT_OR),
    binary($, "^", PREC.BIT_XOR),
    binary($, "&", PREC.BIT_AND),
    binary($, choice("<<", ">>"), PREC.SHIFT),
    binary($, choice("+", "-"), PREC.ADD),
    binary($, choice("*", "/", "%"), PREC.MULTIPLY),
  ),

  between_expression: $ => prec.left(PREC.COMPARE, seq(
    field("value", $._expression),
    optional($.keyword_not),
    $.keyword_between,
    field("lower", $._expression),
    $.keyword_and,
    field("upper", $._expression),
  )),

  in_expression: $ => prec.left(PREC.COMPARE, seq(
    field("value", $._expression),
    optional($.keyword_not),
    $.keyword_in,
    choice(
      seq("(", commaSep1($._expression), ")"),
      $.subquery_expression,
    ),
  )),

  is_expression: $ => prec.left(PREC.COMPARE, seq(
    field("value", $._expression),
    $.keyword_is,
    optional($.keyword_not),
    choice(
      field("test", choice($.keyword_null, $.keyword_true, $.keyword_false)),
      seq(
        field("test", $.keyword_distinct),
        $.keyword_from,
        field("other", $._expression),
      ),
    ),
  )),

  json_access_expression: $ => prec.left(PREC.POSTFIX, seq(
    field("value", $._expression),
    ":",
    field("member", $.identifier),
    repeat(seq(".", field("member", $.identifier))),
  )),

  subscript_expression: $ => prec.left(PREC.POSTFIX, seq(
    field("value", $._expression),
    "[",
    choice(
      field("index", $._expression),
      seq(
        optional(field("lower", $._expression)),
        ":",
        optional(field("upper", $._expression)),
      ),
    ),
    "]",
  )),
};

function binary($, operator, precedence) {
  return prec.left(precedence, seq(
    field("left", $._expression),
    field("operator", operator),
    field("right", $._expression),
  ));
}
