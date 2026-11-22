// Helpers of the grammar's rules.

import { NON_RESERVED, RESERVED } from "./keywords.js";

// Every keyword of avenger-sql-syntax, reserved and not.
export const KEYWORDS = [...RESERVED, ...NON_RESERVED];

// The case-insensitive pattern of a keyword, such as /[sS][eE][lL][eE][cC][tT]/. Every use of
// one keyword builds the same pattern, which the generator interns as one token.
export function caseInsensitive(word) {
  return new RegExp(
    [...word]
      .map(c => {
        const lower = c.toLowerCase();
        const upper = c.toUpperCase();
        return lower === upper ? c : `[${lower}${upper}]`;
      })
      .join(""),
  );
}

// A keyword, which the tree shows as an anonymous node named by its upper-case spelling, such as
// "SELECT", whatever the case of the text.
export function kw(word) {
  return alias(caseInsensitive(word), word);
}

// A keyword that a position reads as a name: the keyword's token as an `identifier`. It aliases
// the raw pattern, because an alias of `kw(word)` would leave the node anonymous.
export function kwAsName($, word) {
  return alias(caseInsensitive(word), $.identifier);
}

// One or more of `rule` separated by commas, with an optional trailing comma, as every list of
// avenger-sql takes.
export function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)), optional(","));
}

// Zero or more of `rule` separated by commas, with an optional trailing comma after one or more.
export function commaSep(rule) {
  return optional(commaSep1(rule));
}
