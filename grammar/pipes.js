// Pipe operators. The operators other than `SELECT` and `WHERE` follow in the grammar's part on
// queries.

import { commaSep1, kw } from "./helpers.js";

export default {
  _pipe_operator: $ => choice($.pipe_select, $.pipe_where),

  // `|> SELECT items`
  pipe_select: $ => seq("|>", kw("SELECT"), commaSep1($._select_entry)),

  // `|> WHERE condition`
  pipe_where: $ => seq("|>", kw("WHERE"), field("condition", $._expr)),

  _select_entry: $ => $.select_item,

  // `expression [[AS] alias]`
  select_item: $ => seq($._expr, optional($.alias)),
};
