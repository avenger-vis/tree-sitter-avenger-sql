/**
 * The Tree-sitter grammar of GoogleSQL's format strings, as avenger-sql's grammar injects them:
 * the elements of `FORMAT_DATE` and its kin, such as `%Y-%m-%d` and `%E4Y`, and the specifiers of
 * `FORMAT`, such as `%'.2f`, which the number patterns of avenger-sql's charts take too.
 *
 * A format is text with `%` directives. A directive is `%`, flags, a width, a precision, an `E` or
 * `O` modifier, and a letter, so one token reads the directives of both syntaxes: which syntax a
 * chart's pattern has depends on the type of its value, which syntax can't know. The grammar
 * accepts every letter. avenger's formatters decide which directives are valid.
 */

export default grammar({
  name: "avenger_format",

  extras: () => [],

  rules: {
    format: $ => repeat(choice($.text, $.escape, $.directive)),

    // Text, and a `%` that starts no directive, as at the end of a format.
    text: () => token(prec(-1, /[^%]+|%/)),

    // `%%`, a percent sign.
    escape: () => "%%",

    // `%`, flags (`-+ #0'` of `FORMAT`, `-_0` of the date elements), a width, a precision, and
    // a letter, with the `E` modifier of `%Ez`, `%E*S`, `%E3S`, and `%E4Y`, or the `O` modifier
    // of `%Od`.
    directive: () =>
      token(/%[-+ #0'_]*([0-9]+|\*)?(\.([0-9]+|\*)?)?(E(\*|[0-9]+)?[A-Za-z]|O[A-Za-z]|[A-Za-z])/),
  },
});
