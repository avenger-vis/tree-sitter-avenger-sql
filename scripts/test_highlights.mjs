import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const fixtures = readdirSync(resolve(root, "test/highlight"))
  .filter(file => file.endsWith(".avenger.sql"))
  .map(file => resolve(root, "test/highlight", file));
if (fixtures.length === 0) throw new Error("no highlight fixtures found");

const executable = process.platform === "win32" ? "tree-sitter.cmd" : "tree-sitter";
const result = spawnSync(executable, ["highlight", "--check", ...fixtures], {
  cwd: root,
  encoding: "utf8",
  shell: process.platform === "win32",
});
if (result.status !== 0) {
  process.stderr.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}
