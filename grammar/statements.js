// The roots, scripts and modules, and their statements. The statements other than queries
// follow in the grammar's part on statements.

import { kw } from "./helpers.js";

export default {
  // A file: a module, which starts with its `MODULE` statement, or a script. A chart script and
  // a data script have the same root, and the language server checks the statements of a role.
  source_file: $ => optional(choice($.module, $.script)),

  // A script: statements separated by `;`.
  script: $ => repeat1(seq($._stmt, optional(";"))),

  // A module: its `MODULE` statement, and the statements after it.
  module: $ => seq($.module_stmt, optional(";"), repeat(seq($._stmt, optional(";")))),

  _stmt: $ => $.query,

  // `MODULE path`
  module_stmt: $ => seq(kw("MODULE"), $.path),
};
