import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const argument = process.argv.indexOf("--avenger-root");
if (argument < 0 || !process.argv[argument + 1]) {
  throw new Error("usage: npm run sync-conformance -- --avenger-root PATH [--check]");
}

const avengerRoot = resolve(process.argv[argument + 1]);
const relativeSource = "avenger-lang-core/tests/fixtures/tokens/tree_sitter_conformance.json";
const sourcePath = resolve(avengerRoot, relativeSource);
const sourceBytes = readFileSync(sourcePath);
const manifest = JSON.parse(sourceBytes.toString("utf8"));
const sourceRevision = execFileSync("git", ["-C", avengerRoot, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const synchronized = {
  synchronization: {
    source_repository: "https://github.com/avenger-vis/avenger",
    source_revision: sourceRevision,
    source_path: relativeSource,
    content_sha256: createHash("sha256").update(sourceBytes).digest("hex"),
  },
  manifest,
};
const output = `${JSON.stringify(synchronized, null, 2)}\n`;
const destination = resolve(root, "test/fixtures/avenger-sql-conformance.json");

if (process.argv.includes("--check")) {
  if (readFileSync(destination, "utf8") !== output) {
    process.stderr.write("synchronized Avenger conformance manifest is stale\n");
    process.exit(1);
  }
} else {
  writeFileSync(destination, output);
}
