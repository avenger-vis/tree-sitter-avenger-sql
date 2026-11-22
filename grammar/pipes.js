// Pipe operators. The operators other than `SELECT` follow in the grammar's part on queries.

import { commaSep1, kw } from "./helpers.js";

export default {
  _pipe_operator: $ => $.pipe_select,

  // `|> SELECT items`
  pipe_select: $ => seq("|>", kw("SELECT"), commaSep1($._select_entry)),

  _select_entry: $ => $.select_item,

  // `expression [[AS] alias]`
  select_item: $ => seq($._expr, optional($.alias)),
};
