// Builds the wasm of each grammar into target/: avenger-sql's, and those of its format,
// datetime, and Quarto Markdown grammars, which editors build from their directories. A wasm
// that builds proves that a grammar's external scanner exports the functions of its name.

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const target = resolve(root, "target");
mkdirSync(target, { recursive: true });
const executable = resolve(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tree-sitter.cmd" : "tree-sitter",
);
const GRAMMARS = [
  [".", "tree-sitter-avenger-sql.wasm"],
  ["format", "tree-sitter-avenger-format.wasm"],
  ["datetime", "tree-sitter-avenger-datetime.wasm"],
  ["qmd", "tree-sitter-avenger-qmd.wasm"],
];
for (const [directory, file] of GRAMMARS) {
  const result = spawnSync(executable, [
    "build",
    "--wasm",
    "--output",
    resolve(target, file),
  ], {
    cwd: resolve(root, directory),
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.stderr.write(`building ${file}\n`);
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? result.error?.message ?? "");
    process.exit(result.status ?? 1);
  }
}
