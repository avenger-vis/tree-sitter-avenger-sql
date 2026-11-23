// Writes the generated part of queries/injections.scm from avenger-sql's
// `string-arguments.json`: the injections of Typst markup and of format patterns into the
// arguments of avenger-sql's chart functions and constructors that hold them.
//
// Usage: node scripts/sync_injections.mjs --avenger-root PATH [--check]
//
// With --check, it writes nothing and fails when the generated part differs from the file.
//
// The file lists calls by their names, and each argument by its name or as the first by
// position, with `array` for the strings of an array. A call with `within` matches only as the
// value of one of those arguments of those enclosing calls, and `unless` leaves out a call whose
// argument list, or whose enclosing call's argument list, sets an argument to a value. The
// patterns group what they can into one regex of names:
//
// - A call without `within` or `unless`: one pattern for each argument and language, over every
//   function that has the argument.
// - A call with `within` or `unless`: for each form of argument and language, one pattern for
//   each argument of the enclosing calls, over every enclosing call that has it.
//
// Grouping the names of functions and of arguments in separate regexes matches their product,
// so each group is of names that all hold the argument: one argument name with many functions,
// or one function with many argument names.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const argument = process.argv.indexOf("--avenger-root");
if (argument < 0 || !process.argv[argument + 1]) {
  throw new Error("usage: node scripts/sync_injections.mjs --avenger-root PATH [--check]");
}
const sourcePath = resolve(process.argv[argument + 1], "avenger-sql/string-arguments.json");
const file = JSON.parse(readFileSync(sourcePath, "utf8"));
if (file.version !== 1) {
  throw new Error(`${sourcePath} is version ${file.version}; this script reads version 1`);
}

const LANGUAGES = new Set(["avenger-typst", "avenger-format"]);
const checkUnless = (unless, where) => {
  if (!unless) return;
  if (!/^[a-z_][a-z0-9_]*$/.test(unless.name) || !Array.isArray(unless.values) || unless.values.length === 0) {
    throw new Error(`the unless of ${where} needs a name and values`);
  }
  for (const value of unless.values) {
    if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error(`a value of the unless of ${where} that isn't a word: ${value}`);
  }
};
for (const call of file.calls) {
  checkUnless(call.unless, call.function);
  for (const place of call.within ?? []) checkUnless(place.unless, `${call.function} in ${place.function}`);
  for (const arg of call.arguments) {
    if (!LANGUAGES.has(arg.language)) throw new Error(`unknown language ${arg.language} of ${call.function}`);
    if (arg.name === undefined && arg.position !== 0) {
      throw new Error(`an argument of ${call.function} has neither a name nor position 0`);
    }
  }
}

// A string of a query: its backslashes and quotes escaped.
const quote = text => `"${text.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

// The regex of a set of names, without case, as SQL compares them.
const names = list => {
  for (const name of list) {
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`a name that isn't an identifier: ${name}`);
  }
  return `^(?i)(${[...new Set(list)].sort().join("|")})$`;
};

// The regex of an argument list that sets `unless.name` to one of `unless.values`, in any of the quotes
// of GoogleSQL's strings, raw or not, without case.
const unlessRegex = unless => {
  const q = `('''|"""|'|")`;
  return `(?i)\\b${unless.name}\\s*=>\\s*r?${q}(${unless.values.join("|")})${q}`;
};

// The text of a pattern, indented: a node is its head, as `(call_expr`, its children, which are
// nodes or lines, and its tail, the closing parenthesis and a capture after it.
const indent = depth => "  ".repeat(depth);
function render(node, depth) {
  if (typeof node === "string") return `${indent(depth)}${node}`;
  const { head, children = [], tail = "" } = node;
  if (children.length === 0) return `${indent(depth)}${head}${tail}`;
  const inner = children.map(child => render(child, depth + 1)).join("\n");
  return `${indent(depth)}${head}\n${inner}${tail}`;
}
// Closing parentheses go on the last child's line, as in the hand-written patterns.
const node = (head, children, tail = "") => ({ head: `(${head}`, children, tail: `)${tail}` });

// The string of an argument, or each string of an array. A string of markup is captured as
// `@_string` for `ESCAPED_BACKSLASH`.
const value = (array, language) => {
  const string = node("string", [node("string_content", [], " @injection.content")], language === TYPST ? " @_string" : "");
  const literal = node("literal", [string]);
  return array ? node("array_expr", [literal]) : literal;
};

// A string that isn't raw and holds an escaped backslash, `\\`. The injected text leaves out the
// string's escape sequences, so in `'\\*a\\*'`, whose markup is `\*a\*`, Typst would read `*a*`
// as strong text. Other escapes only drop characters, so a string of markup with one keeps its
// injection.
const ESCAPED_BACKSLASH = String.raw`(?s)^[^rR].*\\\\`;
const TYPST = "avenger-typst";

// The predicates of the language of a pattern.
const languagePredicates = language =>
  language === TYPST ? [`(#not-match? @_string ${quote(ESCAPED_BACKSLASH)})`] : [];

// The argument list of a call with the argument of `form`: the first by position, or by name.
const argList = (form, array, language, tail) => {
  const v = value(array, language);
  return form === "position"
    ? node("arg_list", [".", node("arg", [v])], tail)
    : node("arg_list", [node("named_arg", ["name: (name_ref) @_argument", { ...v, head: `value: ${v.head}` }])], tail);
};

const call = (form, array, language, argsTail) =>
  node("call_expr", [node("path", [node("name_ref", [], " @_function")]), argList(form, array, language, argsTail)]);

// A pattern: its comment, its nodes, and its predicates.
const pattern = (comment, nodes, predicates, language) =>
  [
    `; ${comment[0].toUpperCase()}${comment.slice(1)}.`,
    render(nodes, 0),
    ...[...predicates, ...languagePredicates(language)].map(p => `  ${p}`),
    `  (#set! injection.language ${quote(language)}))`,
  ].join("\n");

// The pattern's root must stay open for its predicates: take the last `)` off the root's text.
const open = nodes => ({ ...nodes, tail: nodes.tail.slice(1) });

const argumentWords = (form, list, array) =>
  form === "position"
    ? `the first argument${array ? " (an array)" : ""}`
    : `the argument${list.length > 1 ? "s" : ""} ${list.map(n => `\`${n}\``).join(", ")}${array ? " (an array)" : ""}`;

// The values of an `unless` for a comment, as `syntax => 'plain' or 'plain_lines'`.
const valuesWords = unless => `${unless.name} => ${unless.values.map(v => `'${v}'`).join(" or ")}`;

// A list of names for a comment, shortened past four.
const shown = list => {
  const sorted = [...new Set(list)].sort();
  return sorted.length > 4 ? `${sorted.slice(0, 3).join(", ")}, and ${sorted.length - 3} more` : sorted.join(", ");
};

const blocks = [];

// Calls without `within` or `unless`.
const simple = new Map();
for (const c of file.calls.filter(c => !c.within && !c.unless)) {
  for (const arg of c.arguments) {
    const form = arg.name === undefined ? "position" : "name";
    const key = JSON.stringify([form === "position" ? 0 : 1, arg.name ?? "", !!arg.array, arg.language]);
    if (!simple.has(key)) simple.set(key, { form, name: arg.name, array: !!arg.array, language: arg.language, functions: [] });
    simple.get(key).functions.push(c.function);
  }
}
for (const key of [...simple.keys()].sort()) {
  const g = simple.get(key);
  const predicates = [`(#match? @_function ${quote(names(g.functions))})`];
  if (g.form === "name") predicates.push(`(#match? @_argument ${quote(names([g.name]))})`);
  blocks.push(
    pattern(
      `${argumentWords(g.form, [g.name], g.array)} of ${shown(g.functions)}`,
      open(call(g.form, g.array, g.language)),
      predicates,
      g.language,
    ),
  );
}

// Calls with `within` or `unless`, in the order of the file.
for (const c of file.calls.filter(c => c.within || c.unless)) {
  // The forms of argument and language of the call.
  const forms = new Map();
  for (const arg of c.arguments) {
    const form = arg.name === undefined ? "position" : "name";
    const key = JSON.stringify([form === "position" ? 0 : 1, !!arg.array, arg.language]);
    if (!forms.has(key)) forms.set(key, { form, array: !!arg.array, language: arg.language, names: [] });
    if (arg.name !== undefined) forms.get(key).names.push(arg.name);
  }
  // The places of the call: each argument of the enclosing calls, with or without `unless`, or
  // anywhere.
  let places = [null];
  if (c.within) {
    const grouped = new Map();
    for (const place of c.within) {
      const key = JSON.stringify([place.argument, place.unless ?? null]);
      if (!grouped.has(key)) grouped.set(key, { argument: place.argument, unless: place.unless, functions: [] });
      grouped.get(key).functions.push(place.function);
    }
    places = [...grouped.keys()].sort().map(key => grouped.get(key));
  }
  for (const key of [...forms.keys()].sort()) {
    const f = forms.get(key);
    const own = c.unless?.language === f.language ? c.unless : null;
    for (const place of places) {
      const outerUnless = place?.unless?.language === f.language ? place.unless : null;
      const inner = call(f.form, f.array, f.language, own ? " @_args" : "");
      const predicates = [`(#match? @_function ${quote(names([c.function]))})`];
      if (f.form === "name") predicates.push(`(#match? @_argument ${quote(names(f.names))})`);
      if (own) predicates.push(`(#not-match? @_args ${quote(unlessRegex(own))})`);
      let nodes = inner;
      let where = "";
      if (place) {
        nodes = node("call_expr", [
          node("path", [node("name_ref", [], " @_outer")]),
          node(
            "arg_list",
            [node("named_arg", ["name: (name_ref) @_place", { ...inner, head: `value: ${inner.head}` }])],
            outerUnless ? " @_outer_args" : "",
          ),
        ]);
        predicates.push(`(#match? @_outer ${quote(names(place.functions))})`);
        predicates.push(`(#match? @_place ${quote(names([place.argument]))})`);
        if (outerUnless) predicates.push(`(#not-match? @_outer_args ${quote(unlessRegex(outerUnless))})`);
        where = ` as the \`${place.argument}\` of ${shown(place.functions)}${outerUnless ? `, unless that call sets ${valuesWords(outerUnless)}` : ""}`;
      }
      const unlessWords = own ? `, unless it sets ${valuesWords(own)}` : "";
      blocks.push(
        pattern(
          `${argumentWords(f.form, f.names, f.array)} of \`${c.function}(...)\`${where}${unlessWords}`,
          open(nodes),
          predicates,
          f.language,
        ),
      );
    }
  }
}

const START =
  "; generated: the strings of markup and of format patterns of avenger-sql/string-arguments.json, by scripts/sync_injections.mjs";
const END = "; end generated";
const path = resolve(root, "queries/injections.scm");
const text = readFileSync(path, "utf8");
const from = text.indexOf(START);
const to = text.indexOf(END, from);
if (from < 0 || to < 0) throw new Error(`${path} has no generated part that starts with: ${START}`);
const updated = text.slice(0, from) + [START, "", blocks.join("\n\n"), "", END].join("\n") + text.slice(to + END.length);

if (process.argv.includes("--check")) {
  if (updated !== text) {
    process.stderr.write(
      "queries/injections.scm differs from avenger-sql/string-arguments.json; run node scripts/sync_injections.mjs --avenger-root PATH\n",
    );
    process.exit(1);
  }
} else {
  writeFileSync(path, updated);
}
