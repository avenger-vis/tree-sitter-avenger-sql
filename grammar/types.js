import { commaSep1 } from "./helpers.js";

export default {
  data_type: $ => prec.right(seq(
    choice(
      seq($.keyword_double, optional($.keyword_precision)),
      $.keyword_date,
      $.keyword_time,
      $.keyword_timestamp,
      $.qualified_name,
    ),
    optional(seq("(", commaSep1($.number), ")")),
    repeat(seq("[", "]")),
  )),
};
