; Languages inside avenger-sql's strings: JSON in a `JSON` literal. The escape sequences of a
; string stay out of the injected text.

(typed_literal
  "JSON"
  (string
    (string_content) @injection.content)
  (#set! injection.language "json"))
