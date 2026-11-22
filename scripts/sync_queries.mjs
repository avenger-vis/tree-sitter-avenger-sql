// Writes the generated parts of queries/highlights.scm from src/node-types.json, each between
// its marker comments:
//
// - The keywords: every anonymous node that is a keyword, except those that the query captures
//   on their own. A keyword that the grammar only reads as a name has no anonymous node, and a
//   query that named it would not compile.
// - The column of a path expression: a pattern for each type of node that holds an expression,
//   except `extract_expr`, whose date part is no column. A negated field only applies to a named
//   type, so the query can't leave out the part of an `EXTRACT` with one wildcard pattern.
//
// With `--check`, it compares the file with the lists and writes nothing.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const check = process.argv.includes("--check");
const nodeTypes = JSON.parse(readFileSync(resolve(root, "src/node-types.json"), "utf8"));

// The keywords with their own captures: booleans and `NULL`.
const OWN_KEYWORDS = new Set(["TRUE", "FALSE", "NULL"]);
const keywords = nodeTypes
  .filter(node => !node.named && /^[A-Z][A-Z0-9_]*$/.test(node.type) && !OWN_KEYWORDS.has(node.type))
  .map(node => node.type)
  .sort();

// The types that a child of `path_expr`'s type can be: `path_expr` and the supertypes above it.
const holdsPath = new Set(["path_expr"]);
for (let grew = true; grew; ) {
  grew = false;
  for (const node of nodeTypes) {
    if (node.subtypes && !holdsPath.has(node.type) && node.subtypes.some(sub => holdsPath.has(sub.type))) {
      holdsPath.add(node.type);
      grew = true;
    }
  }
}
const children = node => [
  ...(node.children?.types ?? []),
  ...Object.values(node.fields ?? {}).flatMap(field => field.types),
];
const parents = nodeTypes
  .filter(node => node.named && !node.subtypes && node.type !== "extract_expr")
  .filter(node => children(node).some(child => holdsPath.has(child.type)))
  .map(node => node.type)
  .sort();

const blocks = [
  {
    start: "; generated: the keywords of src/node-types.json, by scripts/sync_queries.mjs",
    lines: ["[", ...keywords.map(word => `  "${word}"`), "] @keyword"],
  },
  {
    start: "; generated: the columns of path expressions, by scripts/sync_queries.mjs",
    lines: [
      "[",
      ...parents.map(parent => `  (${parent} (path_expr (path . (name_ref) @variable)))`),
      "]",
    ],
  },
];
const END = "; end generated";

const path = resolve(root, "queries/highlights.scm");
const text = readFileSync(path, "utf8");
let updated = text;
for (const { start, lines } of blocks) {
  const from = updated.indexOf(start);
  const to = updated.indexOf(END, from);
  if (from < 0 || to < 0) throw new Error(`${path} has no generated part that starts with: ${start}`);
  updated = updated.slice(0, from) + [start, ...lines, END].join("\n") + updated.slice(to + END.length);
}

if (check) {
  if (updated !== text) {
    console.error(`${path} differs from src/node-types.json; run node scripts/sync_queries.mjs`);
    process.exit(1);
  }
} else {
  writeFileSync(path, updated);
}
