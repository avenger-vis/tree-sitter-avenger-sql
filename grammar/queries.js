// Queries: a `FROM` clause and pipe operators, and a query in parentheses. A query that starts
// with a query in parentheses follows in the grammar's part on queries.

import { kw } from "./helpers.js";

export default {
  // A query: a `FROM` clause and pipe operators.
  query: $ => seq($.from_clause, repeat($._pipe_operator)),

  // `(query)`
  paren_query: $ => seq("(", $.query, ")"),

  // `FROM source`
  from_clause: $ => seq(kw("FROM"), $._source, optional(",")),

  // `[AS] name`
  alias: $ => seq(optional(kw("AS")), $.name),
};
