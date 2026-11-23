/**
 * The Tree-sitter grammar of the values of GoogleSQL's date, time, and range literals, as
 * avenger-sql's grammar injects them into the strings of `DATE`, `TIME`, `DATETIME`, `TIMESTAMP`,
 * and `RANGE<T>` literals, from the canonical formats of GoogleSQL's `docs/data-types.md`:
 *
 * - a date, `YYYY-[M]M-[D]D`;
 * - a time, `[H]H:[M]M:[S]S[.F]`;
 * - a date and a time, after a space, `T`, or `t`, and a time zone after the time: an offset such
 *   as `-08` or `+05:30`, `Z` or `z`, or, after a space, a name such as `America/Los_Angeles`;
 * - a range, `[lower, upper)`, whose bounds are dates or datetimes, `UNBOUNDED`, or `NULL`.
 *
 * One grammar reads the values of every keyword, so it accepts a time zone in a `DATETIME` and a
 * time in a `DATE`. avenger-sql's analysis decides whether a value is valid for its type.
 */

const digits = /[0-9]{1,2}/;

export default grammar({
  name: "avenger_datetime",

  extras: () => [],

  rules: {
    value: $ => choice($.datetime, $.time, $.range),

    datetime: $ =>
      seq(
        $.date,
        optional(seq(field("separator", choice(" ", "T", "t")), $.time, optional($._zone))),
      ),

    date: $ =>
      seq(
        field("year", alias(/[0-9]{4}/, $.year)),
        "-",
        field("month", alias(digits, $.month)),
        "-",
        field("day", alias(digits, $.day)),
      ),

    time: $ =>
      seq(
        field("hour", alias(digits, $.hour)),
        ":",
        field("minute", alias(digits, $.minute)),
        ":",
        field("second", alias(digits, $.second)),
        optional(seq(".", field("fraction", alias(/[0-9]+/, $.fraction)))),
      ),

    _zone: $ => choice(seq(optional(" "), $.offset), $.utc, seq(" ", $.zone_name)),

    // `-08`, `-8:15`, `+05:30`.
    offset: $ =>
      seq(
        field("sign", choice("+", "-")),
        field("hours", alias(digits, $.hours)),
        optional(seq(":", field("minutes", alias(digits, $.minutes)))),
      ),

    utc: () => choice("Z", "z"),

    // A name of the tz database, such as `UTC` or `America/Argentina/Buenos_Aires`.
    zone_name: () => /[A-Za-z_][A-Za-z0-9_+\-]*(\/[A-Za-z0-9_+\-]+)*/,

    range: $ => seq("[", $._bound, ",", optional(" "), $._bound, ")"),

    _bound: $ => choice($.datetime, $.unbounded, $.null),

    unbounded: () => /[Uu][Nn][Bb][Oo][Uu][Nn][Dd][Ee][Dd]/,

    null: () => /[Nn][Uu][Ll][Ll]/,
  },
});
