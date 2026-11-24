#!/bin/sh
set -eu

tree-sitter generate
git diff --exit-code -- \
  src/grammar.json \
  src/node-types.json \
  src/parser.c \
  src/tree_sitter/alloc.h \
  src/tree_sitter/array.h \
  src/tree_sitter/parser.h
(cd format && tree-sitter generate)
git diff --exit-code -- \
  format/src/grammar.json \
  format/src/node-types.json \
  format/src/parser.c \
  format/src/tree_sitter/alloc.h \
  format/src/tree_sitter/array.h \
  format/src/tree_sitter/parser.h
(cd datetime && tree-sitter generate)
git diff --exit-code -- \
  datetime/src/grammar.json \
  datetime/src/node-types.json \
  datetime/src/parser.c \
  datetime/src/tree_sitter/alloc.h \
  datetime/src/tree_sitter/array.h \
  datetime/src/tree_sitter/parser.h
(cd qmd && tree-sitter generate)
git diff --exit-code -- \
  qmd/src/grammar.json \
  qmd/src/node-types.json \
  qmd/src/parser.c \
  qmd/src/tree_sitter/alloc.h \
  qmd/src/tree_sitter/array.h \
  qmd/src/tree_sitter/parser.h
node scripts/sync_queries.mjs --check
