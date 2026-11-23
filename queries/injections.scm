; Languages inside avenger-sql's strings: JSON in a `JSON` literal, the value of a date, a time,
; or a range literal, the regular expression of a regex function, and the format string of a
; function that formats or parses. The escape sequences of a string stay out of the injected
; text.

(typed_literal
  "JSON"
  (string
    (string_content) @injection.content)
  (#set! injection.language "json"))

; The value of a date, a time, or a range literal, as `2024-01-01` in `DATE '2024-01-01'`, which
; highlights.scm colors as a whole first.
(typed_literal
  [
    "DATE"
    "TIME"
    "DATETIME"
    "TIMESTAMP"
    "RANGE"
  ]
  (string
    (string_content) @injection.content)
  (#set! injection.language "avenger-datetime"))

; The regular expression of GoogleSQL's regex functions, their second argument, in RE2's syntax:
; `REGEXP_CONTAINS`, `REGEXP_EXTRACT`, `REGEXP_EXTRACT_ALL`, `REGEXP_EXTRACT_GROUPS`,
; `REGEXP_INSTR`, `REGEXP_MATCH`, `REGEXP_REPLACE`, and `REGEXP_SUBSTR`. Only a raw string, or a
; string without escape sequences, holds the regular expression as its text: in `'\\d+'`, the
; regular expression is `\d+`, and the injected text would be `d+`.
(call_expr
  (path
    (name_ref) @_function)
  (arg_list
    .
    (arg)
    .
    (arg
      (literal
        (string
          (string_content) @injection.content) @_string)))
  (#match? @_function "^(?i)regexp_(contains|extract|extract_all|extract_groups|instr|match|replace|substr)$")
  (#match? @_string "^([rR]|[^\\\\]*$)")
  (#set! injection.language "regex"))

; The format of the functions that format and parse dates and times, their first argument, and
; of `FORMAT`: a format string, whose elements, such as `%Y`, and specifiers, such as `%'.2f`, are
; GoogleSQL's. The query names every such function of GoogleSQL, also those that avenger-sql's
; library doesn't have yet.
(call_expr
  (path
    (name_ref) @_function)
  (arg_list
    .
    (arg
      (literal
        (string
          (string_content) @injection.content))))
  (#match? @_function "^(?i)(format|(format|parse)_(date|time|datetime|timestamp))$")
  (#set! injection.language "avenger-format"))
