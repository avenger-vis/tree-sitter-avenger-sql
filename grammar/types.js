// Types: a type by its name, `ARRAY<...>`, `STRUCT<...>`, and `RANGE<...>`.

import { commaSep, kw } from "./helpers.js";

export default {
  _type: $ => choice($.named_type, $.array_type, $.struct_type, $.range_type),

  // A type by its name, such as `INT64` or `STRING(10)`, or `INTERVAL`.
  named_type: $ => seq(choice($.name_ref, kw("INTERVAL")), optional($.type_params)),

  // `(parameter, ...)` of a type: literals or `MAX`.
  type_params: $ => seq("(", commaSep(choice($.literal, kw("MAX"))), ")"),

  // `ARRAY<type>`
  array_type: $ => seq(kw("ARRAY"), "<", $._type, ">"),

  // `STRUCT<[name] type, ...>`
  struct_type: $ => seq(kw("STRUCT"), "<", commaSep($.struct_field), ">"),

  // `[name] type`
  struct_field: $ => seq(optional($.name), $._type),

  // `RANGE<type>`
  range_type: $ => seq(kw("RANGE"), "<", $._type, ">"),
};
