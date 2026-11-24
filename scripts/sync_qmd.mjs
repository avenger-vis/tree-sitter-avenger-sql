// Copies Quarto 2's Tree-sitter grammar of Quarto Markdown from a checkout of quarto-dev/q2 into
// qmd/, under the name avenger_qmd, and generates its parser.
//
// Usage: node scripts/sync_qmd.mjs --q2-root PATH [--check]
//
// q2's grammar is named `markdown`, the name of a grammar that editors such as Zed build in, and
// Zed refuses an extension's grammar of a built-in grammar's name. So the copy renames the
// grammar and its external scanner's functions, which must export the grammar's name, and
// regenerates the parser from the renamed grammar.js with this repository's tree-sitter CLI.
// Each rewrite must match as many times as it expects, so a change in q2 that moves one stops
// the sync instead of producing a grammar that doesn't build.
//
// qmd/UPSTREAM records q2's commit and the sha256 of each copied file as q2 has it. With --check,
// the script writes nothing and fails when qmd/ differs from what the checkout produces.

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const argument = process.argv.indexOf("--q2-root");
if (argument < 0 || !process.argv[argument + 1]) {
  throw new Error("usage: node scripts/sync_qmd.mjs --q2-root PATH [--check]");
}
const q2 = resolve(process.argv[argument + 1]);
const check = process.argv.includes("--check");
const source = resolve(q2, "crates/tree-sitter-qmd");
const target = resolve(root, "qmd");

// The scanner's five exported functions, which the grammar's name prefixes.
const SCANNER_FUNCTIONS = ["create", "scan", "serialize", "deserialize", "destroy"];

// A rewrite of `from` to `to`, which must match `count` times: an exact number, or with
// `atLeast` that many or more, for a name that comments may repeat.
const rewrite = (text, file, from, to, count, atLeast = false) => {
  const found = text.split(from).length - 1;
  if (atLeast ? found < count : found !== count) {
    throw new Error(`${file}: expected ${atLeast ? "at least " : ""}${count} of ${JSON.stringify(from)}, found ${found}`);
  }
  return text.split(from).join(to);
};

const rewriteGrammar = (text, file) => {
  let out = rewrite(text, file, "name: 'markdown'", "name: 'avenger_qmd'", 1);
  // qmd/ holds grammar.js beside common/, where q2 has tree-sitter-markdown/ beside common/.
  out = rewrite(out, file, "require('../common/common')", "require('./common/common')", 1);
  return out;
};

const rewriteScanner = (text, file) => {
  for (const name of SCANNER_FUNCTIONS) {
    const definition = new RegExp(`^[a-z *]+tree_sitter_markdown_external_scanner_${name}\\(`, "m");
    if (!definition.test(text)) throw new Error(`${file}: no definition of the scanner's ${name}`);
  }
  const out = rewrite(text, file, "tree_sitter_markdown_external_scanner_", "tree_sitter_avenger_qmd_external_scanner_", SCANNER_FUNCTIONS.length, true);
  if (out.includes("tree_sitter_markdown")) throw new Error(`${file}: a tree_sitter_markdown name is left`);
  return out;
};

// The copied files: qmd/'s path, q2's path under crates/tree-sitter-qmd, and the rewrite.
const corpus = resolve(source, "tree-sitter-markdown/test/corpus");
if (!existsSync(corpus)) throw new Error(`no grammar of q2 at ${source}`);
const files = [
  ["grammar.js", "tree-sitter-markdown/grammar.js", rewriteGrammar],
  ["common/common.js", "common/common.js"],
  ["common/html_entities.json", "common/html_entities.json"],
  ["src/scanner.c", "tree-sitter-markdown/src/scanner.c", rewriteScanner],
  ["LICENSE", "LICENSE"],
  ...readdirSync(corpus)
    .filter(name => name.endsWith(".txt"))
    .sort()
    .map(name => [`test/corpus/${name}`, `tree-sitter-markdown/test/corpus/${name}`]),
];
// The files that `tree-sitter generate` writes.
const GENERATED = [
  "src/parser.c",
  "src/grammar.json",
  "src/node-types.json",
  "src/tree_sitter/alloc.h",
  "src/tree_sitter/array.h",
  "src/tree_sitter/parser.h",
];

const commit = execFileSync("git", ["-C", q2, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

// Writes the copy into `directory`: the copied files, the generated parser, and UPSTREAM.
const produce = directory => {
  const upstream = [`quarto-dev/q2 ${commit}`, ""];
  for (const [path, from, transform] of files) {
    const bytes = readFileSync(resolve(source, from));
    upstream.push(`${sha256(bytes)}  crates/tree-sitter-qmd/${from}`);
    const out = transform ? transform(bytes.toString("utf8"), from) : bytes;
    mkdirSync(dirname(resolve(directory, path)), { recursive: true });
    writeFileSync(resolve(directory, path), out);
  }
  writeFileSync(resolve(directory, "UPSTREAM"), `${upstream.join("\n")}\n`);
  const executable = resolve(root, "node_modules/.bin", process.platform === "win32" ? "tree-sitter.cmd" : "tree-sitter");
  const generated = spawnSync(executable, ["generate"], {
    cwd: directory,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (generated.status !== 0) {
    throw new Error(`tree-sitter generate failed in ${directory}\n${generated.stdout}${generated.stderr}`);
  }
};

const produced = [...files.map(([path]) => path), ...GENERATED, "UPSTREAM"];

if (!check) {
  rmSync(resolve(target, "test/corpus"), { recursive: true, force: true });
  produce(target);
  console.log(`qmd/ is q2's grammar at ${commit}`);
} else {
  const scratch = mkdtempSync(join(tmpdir(), "sync-qmd-"));
  try {
    for (const kept of ["tree-sitter.json", "package.json"]) cpSync(resolve(target, kept), resolve(scratch, kept));
    produce(scratch);
    const differ = produced.filter(path => {
      const ours = resolve(target, path);
      return !existsSync(ours) || !readFileSync(ours).equals(readFileSync(resolve(scratch, path)));
    });
    const extra = readdirSync(resolve(target, "test/corpus"))
      .map(name => `test/corpus/${name}`)
      .filter(path => !produced.includes(path));
    if (differ.length > 0 || extra.length > 0) {
      const lines = [
        ...differ.map(path => `qmd/${path} differs from q2 at ${commit}`),
        ...extra.map(path => `qmd/${path} isn't in q2 at ${commit}`),
        "to update qmd/, run: node scripts/sync_qmd.mjs --q2-root PATH",
      ];
      console.error(lines.join("\n"));
      process.exitCode = 1;
    } else {
      console.log(`qmd/ is q2's grammar at ${commit}`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
