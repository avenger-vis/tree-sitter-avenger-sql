export function caseInsensitive(word) {
  return new RegExp(
    word
      .split("")
      .map(character => {
        const lower = character.toLowerCase();
        const upper = character.toUpperCase();
        return lower === upper ? character : `[${lower}${upper}]`;
      })
      .join(""),
  );
}

export function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

export function commaSep(rule) {
  return optional(commaSep1(rule));
}

export function parenthesized(rule) {
  return seq("(", rule, ")");
}
