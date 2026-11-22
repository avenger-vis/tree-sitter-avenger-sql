// The external scanner of avenger-sql's strings and bytes literals, as avenger-sql-syntax's
// lexer reads them: single, double, and triple quotes, the prefixes `r`, `b`, `rb`, and `br` in
// any case, and backslash escapes. It gives a literal's start (the prefix and the opening
// quotes), the characters of its content, its escape sequences, and its end.
//
// A backslash escapes the next character in a raw literal too, for the end of the literal, and a
// raw literal has no escape sequences. A literal that is not triple ends at a line end, and any
// literal ends at the end of the input, with an end of no width, so the text after an unclosed
// quote still parses. The language server reports the missing quote.

#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>

enum TokenType {
  STRING_START,
  BYTES_START,
  STRING_CHARS,
  ESCAPE_SEQUENCE,
  STRING_END,
};

// The literal that is open: its quote, `'` or `"`, or 0 outside a literal, and whether it is
// triple and raw.
typedef struct {
  uint8_t quote;
  bool triple;
  bool raw;
} Scanner;

static void advance(TSLexer *lexer) { lexer->advance(lexer, false); }

static void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

// GoogleSQL's whitespace, as the grammar's extras.
static bool is_space(int32_t c) {
  switch (c) {
    case ' ':
    case '\t':
    case '\n':
    case '\r':
    case 0x08:
    case 0x0b:
    case 0x0c:
    case 0xa0:
    case 0x202f:
    case 0x205f:
    case 0x3000:
      return true;
    default:
      return c >= 0x2000 && c <= 0x200a;
  }
}

static bool is_line_end(int32_t c) { return c == '\n' || c == '\r'; }

static bool is_hex(int32_t c) {
  return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
}

static bool is_octal(int32_t c) { return c >= '0' && c <= '7'; }

static void close_literal(Scanner *scanner) {
  scanner->quote = 0;
  scanner->triple = false;
  scanner->raw = false;
}

// A literal's start: an optional prefix and the opening quotes.
static bool scan_start(Scanner *scanner, TSLexer *lexer, const bool *valid_symbols) {
  while (is_space(lexer->lookahead)) skip(lexer);

  bool raw = false;
  bool bytes = false;
  for (int prefix = 0; prefix < 2; prefix++) {
    int32_t c = lexer->lookahead;
    if ((c == 'r' || c == 'R') && !raw) {
      raw = true;
    } else if ((c == 'b' || c == 'B') && !bytes) {
      bytes = true;
    } else {
      break;
    }
    advance(lexer);
  }

  int32_t quote = lexer->lookahead;
  if (quote != '\'' && quote != '"') return false;
  if (!valid_symbols[bytes ? BYTES_START : STRING_START]) return false;

  advance(lexer);
  lexer->mark_end(lexer);
  bool triple = false;
  if (lexer->lookahead == quote) {
    advance(lexer);
    if (lexer->lookahead == quote) {
      advance(lexer);
      lexer->mark_end(lexer);
      triple = true;
    }
    // Two quotes alone are an empty literal: the start is the first quote, and the next call
    // reads the second as the end.
  }

  scanner->quote = (uint8_t)quote;
  scanner->triple = triple;
  scanner->raw = raw;
  lexer->result_symbol = bytes ? BYTES_START : STRING_START;
  return true;
}

// An escape sequence of a literal that is not raw, from its backslash. The validation of
// avenger-sql-syntax checks that the escape is one that GoogleSQL accepts.
static bool scan_escape(TSLexer *lexer) {
  advance(lexer);
  int32_t c = lexer->lookahead;
  if (lexer->eof(lexer)) {
    lexer->mark_end(lexer);
    lexer->result_symbol = ESCAPE_SEQUENCE;
    return true;
  }
  int digits = 0;
  bool (*digit)(int32_t) = NULL;
  if (c == 'x' || c == 'X') {
    digits = 2;
    digit = is_hex;
  } else if (c == 'u') {
    digits = 4;
    digit = is_hex;
  } else if (c == 'U') {
    digits = 8;
    digit = is_hex;
  } else if (is_octal(c)) {
    digits = 2;
    digit = is_octal;
  }
  advance(lexer);
  for (int i = 0; i < digits && digit(lexer->lookahead); i++) advance(lexer);
  lexer->mark_end(lexer);
  lexer->result_symbol = ESCAPE_SEQUENCE;
  return true;
}

static bool finish_chars(TSLexer *lexer, const bool *valid_symbols) {
  if (!valid_symbols[STRING_CHARS]) return false;
  lexer->result_symbol = STRING_CHARS;
  return true;
}

static bool finish_end(Scanner *scanner, TSLexer *lexer, const bool *valid_symbols) {
  if (!valid_symbols[STRING_END]) return false;
  close_literal(scanner);
  lexer->result_symbol = STRING_END;
  return true;
}

// Inside a literal: its characters, an escape sequence, or its end.
static bool scan_inside(Scanner *scanner, TSLexer *lexer, const bool *valid_symbols) {
  int32_t quote = scanner->quote;
  bool content = false;
  lexer->mark_end(lexer);

  for (;;) {
    int32_t c = lexer->lookahead;

    if (lexer->eof(lexer) || (!scanner->triple && is_line_end(c))) {
      if (content) return finish_chars(lexer, valid_symbols);
      return finish_end(scanner, lexer, valid_symbols);
    }

    if (c == '\\') {
      if (scanner->raw) {
        advance(lexer);
        if (!lexer->eof(lexer)) advance(lexer);
        content = true;
        lexer->mark_end(lexer);
        continue;
      }
      if (content) return finish_chars(lexer, valid_symbols);
      if (!valid_symbols[ESCAPE_SEQUENCE]) return false;
      return scan_escape(lexer);
    }

    if (c == quote) {
      if (!scanner->triple) {
        if (content) return finish_chars(lexer, valid_symbols);
        advance(lexer);
        lexer->mark_end(lexer);
        return finish_end(scanner, lexer, valid_symbols);
      }
      // In a triple literal, three quotes close it, and one or two are content.
      int count = 0;
      while (count < 3 && lexer->lookahead == quote) {
        advance(lexer);
        count++;
      }
      if (count == 3) {
        if (content) return finish_chars(lexer, valid_symbols);
        lexer->mark_end(lexer);
        return finish_end(scanner, lexer, valid_symbols);
      }
      content = true;
      lexer->mark_end(lexer);
      continue;
    }

    advance(lexer);
    content = true;
    lexer->mark_end(lexer);
  }
}

void *tree_sitter_avenger_sql_external_scanner_create(void) { return calloc(1, sizeof(Scanner)); }

void tree_sitter_avenger_sql_external_scanner_destroy(void *payload) { free(payload); }

unsigned tree_sitter_avenger_sql_external_scanner_serialize(void *payload, char *buffer) {
  Scanner *scanner = (Scanner *)payload;
  buffer[0] = (char)scanner->quote;
  buffer[1] = (char)scanner->triple;
  buffer[2] = (char)scanner->raw;
  return 3;
}

void tree_sitter_avenger_sql_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  Scanner *scanner = (Scanner *)payload;
  close_literal(scanner);
  if (length >= 3) {
    scanner->quote = (uint8_t)buffer[0];
    scanner->triple = buffer[1] != 0;
    scanner->raw = buffer[2] != 0;
  }
}

bool tree_sitter_avenger_sql_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  Scanner *scanner = (Scanner *)payload;
  if (scanner->quote != 0) return scan_inside(scanner, lexer, valid_symbols);
  if (valid_symbols[STRING_START] || valid_symbols[BYTES_START]) return scan_start(scanner, lexer, valid_symbols);
  return false;
}
