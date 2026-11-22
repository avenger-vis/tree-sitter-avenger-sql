// Expressions: literals, query parameters, paths, and calls. The operators, `CASE`, casts, and
// the other forms follow in the grammar's next part.

import { KEYWORDS, commaSep1, kw, kwAsName } from "./helpers.js";

// The words of typed literals, which are names where a later token rules out the literal.
const TYPED_LITERALS = [
  "DATE", "TIME", "DATETIME", "TIMESTAMP", "NUMERIC", "DECIMAL", "BIGNUMERIC", "BIGDECIMAL", "JSON",
];

// The reserved words that are calls before `(`: GoogleSQL's, and avenger-sql's `SELECT(` and
// `INTERVAL(`.
const RESERVED_CALLS = ["IF", "LEFT", "RIGHT", "GROUPING", "COLLATE", "RANGE", "SELECT", "INTERVAL"];

// The functions that GoogleSQL calls without parentheses.
const BARE_CALLS = ["CURRENT_DATE", "CURRENT_TIME", "CURRENT_DATETIME", "CURRENT_TIMESTAMP"];

export default {
  _expr: $ => choice($.literal, $.typed_literal, $.param_expr, $.path_expr, $.call_expr),

  // A number, strings or bytes that concatenate, `NULL`, `TRUE` or `FALSE`.
  literal: $ =>
    choice(
      $.integer,
      $.float,
      seq($.string, repeat($.string)),
      seq($.bytes, repeat($.bytes)),
      kw("NULL"),
      kw("TRUE"),
      kw("FALSE"),
    ),

  // `DATE '...'` and the other typed literals.
  typed_literal: $ =>
    seq(choice(...TYPED_LITERALS.map(kw)), choice($.string, $.bytes), repeat(choice($.string, $.bytes))),

  param_expr: $ => choice($.param, "?"),

  path_expr: $ => $.path,

  // A call: `path(arguments)`, a reserved word's call such as `IF(...)`, or a function that
  // GoogleSQL calls without parentheses, such as `CURRENT_DATE`.
  call_expr: $ =>
    choice(
      seq($.path, $.arg_list),
      seq(alias($._reserved_call_path, $.path), $.arg_list),
      alias($._bare_call_path, $.path),
    ),
  _reserved_call_path: $ => alias($._reserved_call_name, $.name_ref),
  _reserved_call_name: $ => choice(...RESERVED_CALLS.map(word => kwAsName($, word))),
  _bare_call_path: $ => alias($._bare_call_name, $.name_ref),
  _bare_call_name: $ => choice(...BARE_CALLS.map(word => kwAsName($, word))),

  // `(arguments)` of a call.
  arg_list: $ => seq("(", optional(choice($.star_arg, commaSep1($._argument))), ")"),

  _argument: $ => choice($.arg, $.named_arg),

  // A value argument.
  arg: $ => $._expr,

  // `name => value`. Any word is an argument's name, keywords included, as `range => 1`.
  named_arg: $ => seq(field("name", alias($._arg_name, $.name_ref)), "=>", field("value", $._expr)),
  _arg_name: $ => choice($.identifier, $.quoted_identifier, ...KEYWORDS.map(word => kwAsName($, word))),

  // `*`, as in `COUNT(*)`.
  star_arg: _ => "*",

  // Names separated by dots. A name after a dot can start with a digit, as `t.2023`.
  path: $ => seq($.name_ref, repeat(seq(".", choice($.name_ref, alias($._digit_field, $.name_ref))))),
  _digit_field: $ => alias($._digit_name, $.identifier),

  // A name that refers to a definition. The words of typed literals are names where a later
  // token rules out the literal.
  name_ref: $ => choice($.identifier, $.quoted_identifier, ...TYPED_LITERALS.map(word => kwAsName($, word))),

  // A name that a node defines.
  name: $ => choice($.identifier, $.quoted_identifier),
};
