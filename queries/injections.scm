; Languages inside avenger-sql's strings: JSON in a `JSON` literal, and the regular expression of
; a regex function. The escape sequences of a string stay out of the injected text.

(typed_literal
  "JSON"
  (string
    (string_content) @injection.content)
  (#set! injection.language "json"))

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
