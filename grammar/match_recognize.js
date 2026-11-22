// `MATCH_RECOGNIZE` and its row patterns.

import { commaSep1, kw } from "./helpers.js";

export default {
  // `MATCH_RECOGNIZE ([PARTITION BY ...] ORDER BY ... MEASURES ... [AFTER MATCH SKIP ...]
  // PATTERN (...) DEFINE ... [OPTIONS (...)]) [[AS] alias]`, in GoogleSQL's order of clauses.
  match_recognize_clause: $ =>
    seq(
      kw("MATCH_RECOGNIZE"),
      "(",
      optional($.partition_by),
      $.order_by,
      $.measures,
      optional($.after_match_skip),
      $.row_pattern,
      $.define,
      optional($.options),
      ")",
      optional($.alias),
    ),

  // `MEASURES expression AS alias, ...`
  measures: $ => seq(kw("MEASURES"), commaSep1($.measure)),

  // A measure and its alias, whose `AS` is required.
  measure: $ => seq($._expr, kw("AS"), $.name),

  // `AFTER MATCH SKIP {PAST LAST ROW | TO NEXT ROW}`
  after_match_skip: $ =>
    seq(
      kw("AFTER"),
      kw("MATCH"),
      kw("SKIP"),
      choice(seq(kw("PAST"), kw("LAST"), kw("ROW")), seq(kw("TO"), kw("NEXT"), kw("ROW"))),
    ),

  // `PATTERN (pattern)`
  row_pattern: $ => seq(kw("PATTERN"), "(", optional($.pattern_alternation), ")"),

  // Alternatives of a pattern, separated by `|`, where `||` is `| () |`. An alternative can be
  // empty, and an empty pattern has no node.
  pattern_alternation: $ =>
    choice(seq($.pattern_sequence, repeat($._pattern_alternative)), repeat1($._pattern_alternative)),
  _pattern_alternative: $ => seq(choice("|", "||"), optional($.pattern_sequence)),

  // A concatenation of pattern terms.
  pattern_sequence: $ => repeat1($._pattern_term),

  _pattern_term: $ => choice($.pattern_variable, $.pattern_group, $.pattern_anchor),

  // A pattern variable, which `DEFINE` defines, and its quantifier.
  pattern_variable: $ => seq($.name_ref, optional($.quantifier)),

  // `(pattern)` and its quantifier.
  pattern_group: $ => seq("(", optional($.pattern_alternation), ")", optional($.quantifier)),

  // `^`, the start of a partition, or `$`, its end.
  pattern_anchor: _ => choice("^", "$"),

  // `?`, `*`, `+`, `{n}`, `{n,}`, `{n,m}`, `{,m}` or `{,}`, reluctant with a trailing `?`.
  quantifier: $ =>
    seq(
      choice(
        "?",
        "*",
        "+",
        seq("{", optional($.quantifier_min), optional(seq(",", optional($.quantifier_max))), "}"),
      ),
      optional("?"),
    ),

  // The least and the most numbers of repetitions: an `INT64` literal or a query parameter.
  quantifier_min: $ => $._expr,
  quantifier_max: $ => $._expr,

  // `DEFINE variable AS condition, ...`
  define: $ => seq(kw("DEFINE"), commaSep1($.pattern_definition)),

  // A pattern variable and the condition of its rows.
  pattern_definition: $ => seq($.name, kw("AS"), $._expr),
};
