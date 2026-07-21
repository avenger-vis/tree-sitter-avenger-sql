const IDENTIFIER = /[_\p{Alphabetic}][_\p{Alphabetic}0-9]*/;

export default {
  // Reserve sqlparser's unsupported Unicode-string token as one lexical unit.
  // The impossible trailing sentinel makes it an intentional recovery path,
  // rather than allowing `U&'text'` to look like a valid bitwise expression.
  _unsupported_unicode_string: _ => seq(
    token(prec(100, /[uU]&'([^']|'')*'/)),
    token.immediate("\u{10ffff}"),
  ),

  // These hidden productions keep an unterminated quote local to its current
  // line during editing. The impossible sentinel deliberately yields a
  // MISSING/error node; a complete multiline token always wins by length.
  _unterminated_quoted_literal: _ => seq(
    token(prec(-10, choice(
      /'[^'\n\r;,{}\]]*/,
      /[eE]'([^'\\\n\r;,{}\]]|\\[^\n\r])*/,
      /[xX]'[0-9A-Fa-f]*/,
    ))),
    token.immediate("\u{10ffff}"),
  ),

  identifier: _ => IDENTIFIER,

  quoted_identifier: _ => choice(
    token(/""/),
    token(/"[^"\n\r]([^"\n\r]|"")*"/),
  ),

  number: _ => token(
    /((([0-9]+\.[0-9]*)|(\.[0-9]+)|([0-9]+))([eE][+-]?[0-9]+)?L?)/,
  ),

  single_quoted_string: _ => choice(
    token(/''/),
    token(/'[^']([^']|'')*'/),
  ),

  escaped_string: _ => choice(
    token(/[eE]''/),
    token(/[eE]'([^'\\]|\\[^\n\r]|\\\r?\n)([^'\\]|\\[^\n\r]|\\\r?\n|'')*'/),
  ),

  hex_binary_literal: _ => token(/[xX]'[0-9A-Fa-f]*'/),

  literal: $ => choice(
    $.number,
    $.single_quoted_string,
    $.escaped_string,
    $.dollar_quoted_string,
    $.hex_binary_literal,
    $.keyword_true,
    $.keyword_false,
    $.keyword_null,
  ),

  name: $ => choice($.identifier, $.quoted_identifier),

  qualified_name: $ => prec.right(seq(
    field("name", $.name),
    repeat(seq(".", field("member", $.name))),
  )),
};
