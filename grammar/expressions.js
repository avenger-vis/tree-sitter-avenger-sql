// Expressions, with GoogleSQL's operator precedence, and calls with their clauses and windows.

import { KEYWORDS, commaSep, commaSep1, kw, kwAsName } from "./helpers.js";

// The levels at which the operators bind, from the loosest, as in avenger-sql-syntax's parser.
// A comparison's right operand binds at the level of `|`, so comparisons don't chain in
// GoogleSQL; the grammar reads a chain as left-associative, and the language server reports it.
export const PREC = {
  or: 1,
  and: 2,
  not: 3,
  comparison: 4,
  bit_or: 5,
  bit_xor: 6,
  bit_and: 7,
  shift: 8,
  additive: 9,
  concat: 10,
  multiplicative: 11,
  unary: 12,
  postfix: 13,
  path: 14,
};

// The words of typed literals, which are names where a later token rules out the literal.
const TYPED_LITERALS = [
  "DATE", "TIME", "DATETIME", "TIMESTAMP", "NUMERIC", "DECIMAL", "BIGNUMERIC", "BIGDECIMAL", "JSON",
];

// The non-reserved keywords that start an expression or an argument, which are names where a
// later token rules out that reading: the words of typed literals, `SAFE_CAST`, and `TABLE` of
// a table argument.
const NAME_KEYWORDS = [...TYPED_LITERALS, "SAFE_CAST", "TABLE"];

// The reserved words that are calls before `(`: GoogleSQL's, and avenger-sql's `SELECT(` and
// `INTERVAL(`.
const RESERVED_CALLS = ["IF", "LEFT", "RIGHT", "GROUPING", "COLLATE", "RANGE", "SELECT", "INTERVAL"];

// The functions that GoogleSQL calls without parentheses.
const BARE_CALLS = ["CURRENT_DATE", "CURRENT_TIME", "CURRENT_DATETIME", "CURRENT_TIMESTAMP"];

// The kinds of expression.
const EXPRESSIONS = [
  "literal",
  "typed_literal",
  "interval_expr",
  "param_expr",
  "path_expr",
  "field_expr",
  "subscript_expr",
  "prefix_expr",
  "bin_expr",
  "is_expr",
  "is_distinct_expr",
  "between_expr",
  "in_expr",
  "like_expr",
  "case_expr",
  "cast_expr",
  "extract_expr",
  "array_expr",
  "struct_expr",
  "tuple_expr",
  "paren_expr",
  "call_expr",
  "subquery_expr",
  "exists_expr",
  "array_subquery_expr",
];

export default {
  _expr: $ => choice(...EXPRESSIONS.map(name => $[name])),

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

  // `DATE '...'` and the other typed literals, and `RANGE<type> '...'`.
  typed_literal: $ =>
    seq(
      choice(...TYPED_LITERALS.map(kw), seq(kw("RANGE"), "<", $._type, ">")),
      choice($.string, $.bytes),
      repeat(choice($.string, $.bytes)),
    ),

  // `INTERVAL value part [TO part]`
  interval_expr: $ =>
    seq(kw("INTERVAL"), $._expr, field("from", $.name_ref), optional(seq(kw("TO"), field("to", $.name_ref)))),

  // `@name` or `?`
  param_expr: $ => choice($.param, "?"),

  // A column, or a path of a column and its fields.
  path_expr: $ => $.path,

  // `expression.field`, after an expression that is not a path, as in `f(x).y`. A path takes
  // every name after its dots, as in avenger-sql-syntax, so a field never follows a path.
  field_expr: $ =>
    prec(PREC.postfix, seq($._field_base, ".", choice($.name_ref, alias($._digit_field, $.name_ref)))),
  _field_base: $ =>
    prec(PREC.postfix, choice(...EXPRESSIONS.filter(name => name !== "path_expr").map(name => $[name]))),

  // `expression[index]`
  subscript_expr: $ => prec(PREC.postfix, seq(field("base", $._expr), "[", field("index", $._expr), "]")),

  // `-x`, `+x`, `~x` or `NOT x`
  prefix_expr: $ =>
    choice(
      prec(PREC.unary, seq(field("op", choice("-", "+", "~")), $._expr)),
      prec(PREC.not, seq(field("op", kw("NOT")), $._expr)),
    ),

  // A binary operator and its operands. `<>` is `<` and an adjacent `>`, as in avenger-sql-syntax.
  // `>>` is one token, because one token of lookahead can't tell `>` from the start of `>>`. The
  // lexer offers `>>` only after an expression, so a nested type such as `ARRAY<ARRAY<INT64>>`
  // still closes with two `>` tokens.
  bin_expr: $ => {
    const level = (precedence, operator) =>
      prec.left(precedence, seq(field("lhs", $._expr), field("op", operator), field("rhs", $._expr)));
    return choice(
      level(PREC.or, kw("OR")),
      level(PREC.and, kw("AND")),
      level(PREC.comparison, choice("=", "!=", "<", "<=", ">", ">=", seq("<", token.immediate(">")))),
      level(PREC.bit_or, "|"),
      level(PREC.bit_xor, "^"),
      level(PREC.bit_and, "&"),
      level(PREC.shift, choice("<<", ">>")),
      level(PREC.additive, choice("+", "-")),
      level(PREC.concat, "||"),
      level(PREC.multiplicative, choice("*", "/")),
    );
  },

  // `x IS [NOT] {NULL | TRUE | FALSE | UNKNOWN}`
  is_expr: $ =>
    prec.left(
      PREC.comparison,
      seq($._expr, kw("IS"), optional(kw("NOT")), choice(kw("NULL"), kw("TRUE"), kw("FALSE"), kw("UNKNOWN"))),
    ),

  // `x IS [NOT] DISTINCT FROM y`
  is_distinct_expr: $ =>
    prec.left(
      PREC.comparison,
      seq(
        field("lhs", $._expr),
        kw("IS"),
        optional(kw("NOT")),
        kw("DISTINCT"),
        kw("FROM"),
        field("rhs", $._expr),
      ),
    ),

  // `x [NOT] BETWEEN low AND high`
  between_expr: $ =>
    prec.left(
      PREC.comparison,
      seq(
        field("value", $._expr),
        optional(kw("NOT")),
        kw("BETWEEN"),
        field("low", $._between_operand),
        kw("AND"),
        field("high", $._between_operand),
      ),
    ),
  // An operand of `BETWEEN`, which holds the operators of the level of `|` and tighter, so its
  // `AND` ends the low bound and a comparison after it applies to the whole `BETWEEN`.
  _between_operand: $ => prec.left(PREC.comparison, $._expr),

  // `x [NOT] IN (values)`, `x [NOT] IN (query)`, or `x [NOT] IN UNNEST(array)`
  in_expr: $ => prec.left(PREC.comparison, seq($._expr, optional(kw("NOT")), kw("IN"), $._in_set)),

  _in_set: $ => choice($.in_list, $.in_query, $.in_unnest),

  // `(values)`
  in_list: $ => seq("(", commaSep($._expr), ")"),

  // `(query)`
  in_query: $ => $.paren_query,

  // `UNNEST(array)`
  in_unnest: $ => seq(kw("UNNEST"), "(", $._expr, ")"),

  // `x [NOT] LIKE pattern`, or `x [NOT] LIKE {ANY | SOME | ALL} (patterns)`
  like_expr: $ =>
    prec.left(
      PREC.comparison,
      seq(
        field("value", $._expr),
        optional(kw("NOT")),
        kw("LIKE"),
        choice(field("pattern", $._expr), $.quantified_patterns),
      ),
    ),

  // `{ANY | SOME | ALL} (patterns)`
  quantified_patterns: $ => seq(choice(kw("ANY"), kw("SOME"), kw("ALL")), $._in_set),

  // `CASE [value] WHEN ... THEN ... [ELSE ...] END`
  case_expr: $ =>
    seq(kw("CASE"), optional(field("operand", $._expr)), repeat($.when_clause), optional($.else_clause), kw("END")),

  // `WHEN condition THEN result`
  when_clause: $ => seq(kw("WHEN"), field("condition", $._expr), kw("THEN"), field("result", $._expr)),

  // `ELSE result`
  else_clause: $ => seq(kw("ELSE"), $._expr),

  // `CAST(value AS type [FORMAT ...])`, or `SAFE_CAST`.
  // `SAFE_CAST(` is always a cast, and `safe_cast` is a name only where no `(` follows.
  cast_expr: $ =>
    prec(
      PREC.postfix,
      seq(choice(kw("CAST"), kw("SAFE_CAST")), "(", $._expr, kw("AS"), $._type, optional($.format_clause), ")"),
    ),

  // `FORMAT format [AT TIME ZONE zone]`
  format_clause: $ => seq(kw("FORMAT"), $._expr, optional($.time_zone)),

  // `AT TIME ZONE zone`
  time_zone: $ => seq(kw("AT"), kw("TIME"), kw("ZONE"), $._expr),

  // `EXTRACT(part FROM value [AT TIME ZONE zone])`
  extract_expr: $ =>
    seq(
      kw("EXTRACT"),
      "(",
      field("part", $._expr),
      kw("FROM"),
      field("value", $._expr),
      optional($.time_zone),
      ")",
    ),

  // `[ARRAY[<type>]] [elements]`
  array_expr: $ =>
    seq(optional(seq(kw("ARRAY"), optional(seq("<", $._type, ">")))), "[", commaSep($._expr), "]"),

  // `STRUCT[<fields>](values)`
  struct_expr: $ =>
    seq(kw("STRUCT"), optional(seq("<", commaSep($.struct_field), ">")), "(", commaSep($.aliased_expr), ")"),

  // `(a, b, ...)`: a tuple, which has a comma.
  tuple_expr: $ => seq("(", $._expr, ",", commaSep($._expr), ")"),

  // `(expression)`
  paren_expr: $ => seq("(", $._expr, ")"),

  // `(query)` as a value.
  subquery_expr: $ => $.paren_query,

  // `EXISTS (query)`
  exists_expr: $ => seq(kw("EXISTS"), $.paren_query),

  // `ARRAY (query)`
  array_subquery_expr: $ => seq(kw("ARRAY"), $.paren_query),

  // An expression and its alias.
  aliased_expr: $ => seq($._expr, optional($.alias)),

  // A call: `path(arguments) [OVER window]`, a reserved word's call such as `IF(...)`, or a
  // function that GoogleSQL calls without parentheses, such as `CURRENT_DATE`.
  call_expr: $ =>
    choice(
      seq($.path, $.arg_list, optional($.over_clause)),
      seq(alias($._reserved_call_path, $.path), $.arg_list, optional($.over_clause)),
      alias($._bare_call_path, $.path),
    ),
  _reserved_call_path: $ => alias($._reserved_call_name, $.name_ref),
  _reserved_call_name: $ => choice(...RESERVED_CALLS.map(word => kwAsName($, word))),
  _bare_call_path: $ => alias($._bare_call_name, $.name_ref),
  _bare_call_name: $ => choice(...BARE_CALLS.map(word => kwAsName($, word))),

  // `([DISTINCT] arguments [{IGNORE | RESPECT} NULLS] [HAVING {MAX | MIN} x] [ORDER BY ...]
  // [LIMIT n])` of a call, or the arguments of a table function call.
  arg_list: $ =>
    seq(
      "(",
      optional(kw("DISTINCT")),
      optional(choice(seq($.star_arg, repeat(seq(",", $._argument)), optional(",")), commaSep1($._argument))),
      optional($.null_treatment),
      optional($.having_clause),
      optional($.order_by),
      optional($.call_limit),
      ")",
    ),

  _argument: $ => choice($.arg, $.named_arg, $.table_arg, $.named_table_arg),

  // A value argument.
  arg: $ => $._expr,

  // `name => value`. Any word is an argument's name, keywords included, as `range => 1`.
  named_arg: $ => seq(field("name", alias($._arg_name, $.name_ref)), "=>", field("value", $._expr)),
  _arg_name: $ => choice($.identifier, $.quoted_identifier, ...KEYWORDS.map(word => kwAsName($, word))),

  // `*`, as in `COUNT(*)`.
  star_arg: _ => "*",

  // `TABLE name`, an argument of a table function.
  table_arg: $ => seq(kw("TABLE"), $.path),

  // `name => TABLE name`
  named_table_arg: $ =>
    seq(field("name", alias($._arg_name, $.name_ref)), "=>", kw("TABLE"), $.path),

  // `{IGNORE | RESPECT} NULLS`
  null_treatment: $ => seq(choice(kw("IGNORE"), kw("RESPECT")), kw("NULLS")),

  // `HAVING {MAX | MIN} expression` of an aggregate call.
  having_clause: $ => seq(kw("HAVING"), choice(kw("MAX"), kw("MIN")), $._expr),

  // `LIMIT n` of an aggregate call.
  call_limit: $ => seq(kw("LIMIT"), $._expr),

  // `OVER window`
  over_clause: $ => seq(kw("OVER"), choice($.name_ref, $.window_spec)),

  // `([name] [PARTITION BY ...] [ORDER BY ...] [frame])`
  window_spec: $ =>
    seq("(", optional($.name_ref), optional($.partition_by), optional($.order_by), optional($.frame), ")"),

  // `PARTITION BY expressions`
  partition_by: $ => seq(kw("PARTITION"), kw("BY"), commaSep1($._expr)),

  // `ORDER BY keys`
  order_by: $ => seq(kw("ORDER"), kw("BY"), commaSep1($.order_key)),

  // `expression [ASC | DESC] [NULLS {FIRST | LAST}]`
  order_key: $ =>
    seq(
      $._expr,
      optional(choice(kw("ASC"), kw("DESC"))),
      optional(seq(kw("NULLS"), choice(kw("FIRST"), kw("LAST")))),
    ),

  // `{ROWS | RANGE} bound`, or `{ROWS | RANGE} BETWEEN bound AND bound`
  frame: $ =>
    seq(
      choice(kw("ROWS"), kw("RANGE")),
      choice(
        seq(kw("BETWEEN"), field("start", $.frame_bound), kw("AND"), field("end", $.frame_bound)),
        field("start", $.frame_bound),
      ),
    ),

  // `UNBOUNDED {PRECEDING | FOLLOWING}`, `CURRENT ROW`, or `n {PRECEDING | FOLLOWING}`
  frame_bound: $ =>
    choice(
      seq(kw("UNBOUNDED"), choice(kw("PRECEDING"), kw("FOLLOWING"))),
      seq(kw("CURRENT"), kw("ROW")),
      seq($._expr, choice(kw("PRECEDING"), kw("FOLLOWING"))),
    ),

  // Names separated by dots. A name after a dot can start with a digit, as `t.2023`, or be any
  // keyword, reserved ones included, as `t.select`.
  //
  // The names after the first are a hidden recursive rule, not a `repeat`, because the helper
  // rule of a `repeat` has no precedence, and a path takes every name before a prefix operator
  // or a field access can end it: `-a.b.c` is `-(a.b.c)`. The hidden rule's children are the
  // path's own, so the path stays flat.
  path: $ => prec.right(PREC.path, seq($.name_ref, optional($._path_names))),
  _path_names: $ => prec.right(PREC.path, choice($._path_name, seq($._path_names, $._path_name))),
  _path_name: $ =>
    seq(".", choice($.name_ref, alias($._digit_field, $.name_ref), alias($._keyword_field, $.name_ref))),
  _digit_field: $ => alias($._digit_name, $.identifier),
  _keyword_field: $ =>
    choice(...KEYWORDS.filter(word => !NAME_KEYWORDS.includes(word)).map(word => kwAsName($, word))),

  // A name that refers to a definition. The non-reserved keywords that start an expression or an
  // argument are names where a later token rules out the keyword's reading.
  name_ref: $ => choice($.identifier, $.quoted_identifier, ...NAME_KEYWORDS.map(word => kwAsName($, word))),

  // A name that a node defines.
  name: $ => choice($.identifier, $.quoted_identifier),
};
