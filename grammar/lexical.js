// The lexical layer: names, numbers, query parameters, comments, hints, and the strings and
// bytes literals that the external scanner reads. It follows avenger-sql-syntax's lexer.

export default {
  // A word that is not a keyword where the parser reads it. A keyword that the grammar reads
  // as a name is also an `identifier` (`kwAsName`).
  identifier: _ => /[A-Za-z_][A-Za-z0-9_]*/,

  // A name in backticks, with backslash escapes.
  quoted_identifier: _ => /`([^`\\\r\n]|\\.)*`/,

  // A field's name that starts with a digit, which is a name only after a field's `.`, as in
  // `t.2023`.
  _digit_name: _ => /[0-9][A-Za-z0-9_]*/,

  integer: _ => token(choice(/[0-9]+/, /0[xX][0-9A-Fa-f]+/)),

  // `1.`, `.5`, `1.5`, and an exponent, as in `1e10` or `1.5E-3`.
  float: _ =>
    token(
      choice(
        /[0-9]+\.[0-9]*([eE][+-]?[0-9]+)?/,
        /\.[0-9]+([eE][+-]?[0-9]+)?/,
        /[0-9]+[eE][+-]?[0-9]+/,
      ),
    ),

  // `@name`, `@ name`, or `@` and a name in backticks.
  param: _ => /@[ \t\r\n]*([A-Za-z_][A-Za-z0-9_]*|`([^`\\\r\n]|\\.)*`)/,

  // `--` or `#` to the end of the line, or `/* */` without nesting.
  comment: _ =>
    token(
      choice(
        seq("--", /[^\r\n]*/),
        seq("#", /[^\r\n]*/),
        seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/"),
      ),
    ),

  // `--|` to the end of the line: a doc comment, which documents the definition after it. It wins
  // over `comment` by its precedence. A Quarto cell's options are `#|` lines, which are comments.
  doc_comment: _ => token(prec(1, seq("--|", /[^\r\n]*/))),

  // A hint, `@{...}` or `@` and digits, which avenger-sql reports as unsupported.
  hint: _ => token(choice(/@\{[^}]*\}/, /@[0-9]+/)),

  // A string or bytes literal: a start (the prefix and the opening quotes), its content, and
  // its end, all from the external scanner.
  string: $ => seq($._string_start, optional($.string_content), $._string_end),
  bytes: $ => seq($._bytes_start, optional($.string_content), $._string_end),
  string_content: $ => repeat1(choice($._string_chars, $.escape_sequence)),
};
