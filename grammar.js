// The Tree-sitter grammar of avenger-sql, the subset of GoogleSQL that avenger-sql-syntax
// parses. The named nodes are the nodes of avenger-sql-syntax's `sql.ungram`, in snake case.

import expressions from "./grammar/expressions.js";
import { caseInsensitive } from "./grammar/helpers.js";
import { RESERVED } from "./grammar/keywords.js";
import lexical from "./grammar/lexical.js";
import matchRecognize from "./grammar/match_recognize.js";
import pipes from "./grammar/pipes.js";
import queries from "./grammar/queries.js";
import sources from "./grammar/sources.js";
import statements from "./grammar/statements.js";
import types from "./grammar/types.js";

export default grammar({
  name: "avenger_sql",

  // GoogleSQL's whitespace, including the Unicode spaces of avenger-sql-syntax's lexer.
  extras: $ => [/[ \t\n\r\x08\x0b\x0c  -   　]/, $.comment, $.doc_comment, $.hint],

  externals: $ => [$._string_start, $._bytes_start, $._string_chars, $.escape_sequence, $._string_end],

  word: $ => $.identifier,

  // GoogleSQL's reserved keywords never lex as an `identifier`, even where the keyword is not
  // valid. Each is a token of the grammar, because every keyword is an argument's name.
  reserved: {
    global: _ => RESERVED.map(caseInsensitive),
  },

  // The prefixes that two readings share, which a later token decides.
  conflicts: $ => [
    // `INTERVAL (x) DAY` is an interval, and `INTERVAL(x)` a call.
    [$.interval_expr, $._reserved_call_name],
    // After `ORDER BY k,` or `PARTITION BY k,`, `RANGE` starts an item, as `RANGE(1, 2)`, or
    // the window's frame.
    [$.order_by],
    [$.partition_by],
    // In `MATCH_RECOGNIZE`, after a trailing comma of `MEASURES`, `AFTER` or `PATTERN` starts a
    // measure or the next clause.
    [$.measures],
    // After a source, `PIVOT` or `UNPIVOT` is an alias, or starts a clause when `(` or
    // `INCLUDE` or `EXCLUDE` follows it.
    [$.table_source],
    [$.subquery_source],
    [$.unnest_source],
    [$.tvf_source],
  ],

  supertypes: $ => [
    $._stmt,
    $._expr,
    $._type,
    $._source,
    $._pipe_operator,
    $._select_entry,
    $._argument,
    $._in_set,
    $._join_condition,
    $._grouping_item,
    $._pattern_term,
  ],

  rules: {
    ...statements,
    ...queries,
    ...sources,
    ...pipes,
    ...matchRecognize,
    ...expressions,
    ...types,
    ...lexical,
  },
});
