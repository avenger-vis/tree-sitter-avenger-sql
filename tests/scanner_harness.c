// Runs the external scanner over every text of a small alphabet up to a length, and over
// texts that exercise its forms, under the address and undefined-behavior sanitizers. At each
// position it scans with every token valid, as Tree-sitter's error recovery does, and with each
// token valid alone, and it checks that a token never ends before its start, that the scanner
// state survives serialization, and that a scan of a whole text ends.

#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void *tree_sitter_avenger_sql_external_scanner_create(void);
void tree_sitter_avenger_sql_external_scanner_destroy(void *payload);
unsigned tree_sitter_avenger_sql_external_scanner_serialize(void *payload, char *buffer);
void tree_sitter_avenger_sql_external_scanner_deserialize(void *payload, const char *buffer, unsigned length);
bool tree_sitter_avenger_sql_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols);

enum { TOKEN_COUNT = 5, MAX_TEXT = 64 };

typedef struct {
  TSLexer lexer;
  const int32_t *text;
  uint32_t length;
  uint32_t position;
  uint32_t end;
} Input;

static void input_advance(TSLexer *lexer, bool skip) {
  (void)skip;
  Input *input = (Input *)lexer;
  if (input->position < input->length) input->position++;
  lexer->lookahead = input->position < input->length ? input->text[input->position] : 0;
}

static void input_mark_end(TSLexer *lexer) {
  Input *input = (Input *)lexer;
  input->end = input->position;
}

static uint32_t input_get_column(TSLexer *lexer) { return ((Input *)lexer)->position; }

static bool input_is_at_included_range_start(const TSLexer *lexer) {
  (void)lexer;
  return false;
}

static bool input_eof(const TSLexer *lexer) {
  const Input *input = (const Input *)lexer;
  return input->position >= input->length;
}

static void input_log(const TSLexer *lexer, const char *format, ...) {
  (void)lexer;
  (void)format;
}

static void input_seek(Input *input, uint32_t position) {
  input->position = position;
  input->end = position;
  input->lexer.lookahead = position < input->length ? input->text[position] : 0;
}

static unsigned failures = 0;

static void fail(const char *message, const int32_t *text, uint32_t length, uint32_t position) {
  failures++;
  fprintf(stderr, "%s at %u of: ", message, position);
  for (uint32_t i = 0; i < length; i++) fputc(text[i] < 128 ? (char)text[i] : '?', stderr);
  fputc('\n', stderr);
}

// Scans `text` from its start, as a parser would, with every token valid, and at each position
// also tries each token alone from a copy of the state.
static void scan_text(const int32_t *text, uint32_t length) {
  Input input = {
      .lexer =
          {
              .advance = input_advance,
              .mark_end = input_mark_end,
              .get_column = input_get_column,
              .is_at_included_range_start = input_is_at_included_range_start,
              .eof = input_eof,
              .log = input_log,
          },
      .text = text,
      .length = length,
  };
  bool all[TOKEN_COUNT];
  for (int i = 0; i < TOKEN_COUNT; i++) all[i] = true;

  void *scanner = tree_sitter_avenger_sql_external_scanner_create();
  void *probe = tree_sitter_avenger_sql_external_scanner_create();
  char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  char again[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];

  uint32_t position = 0;
  unsigned steps = 0;
  while (position <= length && steps++ < 4 * MAX_TEXT + 8) {
    unsigned size = tree_sitter_avenger_sql_external_scanner_serialize(scanner, state);
    tree_sitter_avenger_sql_external_scanner_deserialize(probe, state, size);
    unsigned size_again = tree_sitter_avenger_sql_external_scanner_serialize(probe, again);
    if (size != size_again || memcmp(state, again, size) != 0) fail("state changed by serialization", text, length, position);

    for (int token = 0; token < TOKEN_COUNT; token++) {
      bool alone[TOKEN_COUNT] = {false};
      alone[token] = true;
      tree_sitter_avenger_sql_external_scanner_deserialize(probe, state, size);
      input_seek(&input, position);
      if (tree_sitter_avenger_sql_external_scanner_scan(probe, &input.lexer, alone)) {
        if (input.lexer.result_symbol != token) fail("token outside the valid set", text, length, position);
        if (input.end < position) fail("token ends before its start", text, length, position);
      }
    }

    input_seek(&input, position);
    if (tree_sitter_avenger_sql_external_scanner_scan(scanner, &input.lexer, all)) {
      if (input.end < position) fail("token ends before its start", text, length, position);
      if (input.end > position) {
        position = input.end;
        continue;
      }
      // A token of no width, an end, leaves the literal, so the next scan moves on.
      continue;
    }
    // No external token here: the internal lexer would read one character or more.
    position++;
  }
  if (position <= length) fail("the scan did not end", text, length, position);

  tree_sitter_avenger_sql_external_scanner_destroy(probe);
  tree_sitter_avenger_sql_external_scanner_destroy(scanner);
}

static void scan_ascii(const char *text) {
  int32_t buffer[MAX_TEXT];
  uint32_t length = 0;
  for (; text[length] != '\0' && length < MAX_TEXT; length++) buffer[length] = (unsigned char)text[length];
  scan_text(buffer, length);
}

int main(void) {
  // Every text of these characters, up to six of them.
  static const int32_t alphabet[] = {'\'', '"', '\\', 'r', 'b', 'x', '\n', ' ', 0x3000};
  enum { SIZE = sizeof(alphabet) / sizeof(alphabet[0]), LONGEST = 6 };
  int32_t text[LONGEST];
  unsigned long texts = 0;
  for (uint32_t length = 0; length <= LONGEST; length++) {
    unsigned long count = 1;
    for (uint32_t i = 0; i < length; i++) count *= SIZE;
    for (unsigned long n = 0; n < count; n++) {
      unsigned long rest = n;
      for (uint32_t i = 0; i < length; i++) {
        text[i] = alphabet[rest % SIZE];
        rest /= SIZE;
      }
      scan_text(text, length);
      texts++;
    }
  }

  static const char *const forms[] = {
      "'a' \"b\" '''c ' d '' e''' \"\"\"f\"\"\"",
      "r'a\\'b' R\"\\\\\" rb'\\x00' BR\"x\" b'' ''''''",
      "'\\x41\\X4a\\u00e9\\U0001F600\\101\\7\\'\\\\'",
      "'unclosed\n'next'",
      "'''open\nstill open",
      "'\\",
      "r'\\",
      "'''a''''",
  };
  for (size_t i = 0; i < sizeof(forms) / sizeof(forms[0]); i++) scan_ascii(forms[i]);

  if (failures > 0) {
    fprintf(stderr, "%u failures\n", failures);
    return 1;
  }
  printf("scanned %lu texts and %zu forms\n", texts, sizeof(forms) / sizeof(forms[0]));
  return 0;
}
