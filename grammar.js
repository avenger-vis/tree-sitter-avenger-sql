import expressionRules from "./grammar/expressions.js";
import keywordRules from "./grammar/keywords.js";
import lexicalRules from "./grammar/lexical.js";
import queryRules from "./grammar/queries.js";
import typeRules from "./grammar/types.js";

export default grammar({
  name: "avenger_sql",

  extras: $ => [
    /\s/,
    $.line_comment,
    $.block_comment,
  ],

  externals: $ => [
    $.line_comment,
    $.block_comment,
    $.dollar_quoted_string,
  ],

  word: $ => $.identifier,

  rules: {
    source_file: $ => seq(
      choice(
        field("query", $._query),
        field("expression", $._expression),
      ),
      optional(";"),
    ),

    ...keywordRules,
    ...lexicalRules,
    ...typeRules,
    ...expressionRules,
    ...queryRules,
  },
});
