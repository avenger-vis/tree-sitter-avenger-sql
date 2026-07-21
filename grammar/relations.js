import { commaSep1 } from "./helpers.js";

export default {
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
    field("name", choice($.identifier, $.quoted_identifier)),
    optional(seq("(", commaSep1(choice($.identifier, $.quoted_identifier)), ")")),
  ),

  subquery_relation: $ => seq("(", $._query, ")"),

  join_clause: $ => seq(
    optional(choice(
      $.keyword_natural,
      $.keyword_cross,
      $.keyword_inner,
      seq($.keyword_left, optional($.keyword_outer)),
      seq($.keyword_right, optional($.keyword_outer)),
      seq($.keyword_full, optional($.keyword_outer)),
    )),
    $.keyword_join,
    optional($.keyword_lateral),
    field("relation", $.relation),
    optional(choice(
      seq($.keyword_on, field("predicate", $._expression)),
      seq(
        $.keyword_using,
        "(",
        commaSep1(choice($.identifier, $.quoted_identifier)),
        ")",
      ),
    )),
  ),
};
