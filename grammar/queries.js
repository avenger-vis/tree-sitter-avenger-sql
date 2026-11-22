// Queries: a `FROM` clause, or a query in parentheses, and pipe operators.

import { kw } from "./helpers.js";

export default {
  // A query: a `FROM` clause, or a query in parentheses and its alias, and pipe operators. As in
  // avenger-sql-syntax, `((FROM t))` is a query in parentheses whose query is in parentheses, and
  // `((FROM t) + 1)` an expression.
  query: $ => seq(choice($.from_clause, seq($.paren_query, optional($.alias))), repeat($._pipe_operator)),

  // `(query)`
  paren_query: $ => seq("(", $.query, ")"),

  // `FROM source`
  from_clause: $ => seq(kw("FROM"), $._source, optional(",")),

  // `[AS] name`
  alias: $ => seq(optional(kw("AS")), $.name),
};
