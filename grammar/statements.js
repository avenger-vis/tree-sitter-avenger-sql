// The roots, scripts and modules, and their statements: queries, `IMPORT MODULE`, `DECLARE`,
// `SET`, `CREATE` of tables, functions, constants, external tables, views, and schemas, and
// `LOAD DATA`. One grammar parses chart scripts, data scripts, and modules, and the language
// server checks the statements that a file's role holds.

import { commaSep, commaSep1, kw, kwAsName } from "./helpers.js";

// `CREATE [OR REPLACE] [TEMP | TEMPORARY | PUBLIC | PRIVATE]`, the start of every `CREATE`.
// avenger-sql-syntax checks the scopes that a statement and a role take.
const create = $ =>
  seq(
    kw("CREATE"),
    optional(seq(kw("OR"), kw("REPLACE"))),
    optional(field("scope", choice(kw("TEMP"), kw("TEMPORARY"), kw("PUBLIC"), kw("PRIVATE")))),
  );

// A statement. Statements need no `;` between them, so a statement in parentheses could follow
// one that ends in a list, a type, or an expression; as in avenger-sql-syntax, `(` there continues
// the statement, so every statement is right-associative.
const stmt = (...parts) => prec.right(seq(...parts));

// `IF NOT EXISTS`
const ifNotExists = () => optional(seq(kw("IF"), kw("NOT"), kw("EXISTS")));

export default {
  // A file: a module, which starts with its `MODULE` statement, or a script. A chart script and
  // a data script have the same root.
  source_file: $ => optional(choice($.module, $.script)),

  // A script: statements separated by `;`.
  script: $ => repeat1(seq($._stmt, optional(";"))),

  // A module: its `MODULE` statement, and the statements after it.
  module: $ => seq($.module_stmt, optional(";"), repeat(seq($._stmt, optional(";")))),

  _stmt: $ =>
    choice(
      $.query,
      $.import_stmt,
      $.declare_stmt,
      $.set_stmt,
      $.create_table_stmt,
      $.create_function_stmt,
      $.create_constant_stmt,
      $.create_external_table_stmt,
      $.create_view_stmt,
      $.create_schema_stmt,
      $.load_data_stmt,
    ),

  // `MODULE path [OPTIONS (...)]`
  module_stmt: $ => stmt(kw("MODULE"), $.path, optional($.options)),

  // `IMPORT MODULE path [AS alias] [OPTIONS (...)]`
  import_stmt: $ => stmt(kw("IMPORT"), kw("MODULE"), $.path, optional($.alias), optional($.options)),

  // `DECLARE names [type] [DEFAULT value]`. The names take no trailing comma, since a type can
  // follow them.
  declare_stmt: $ =>
    stmt(
      kw("DECLARE"),
      field("name", $.name),
      repeat(seq(",", field("name", $.name))),
      optional($._type),
      optional(seq(kw("DEFAULT"), $._expr)),
    ),

  // `SET name = value`, or `SET (names) = value`
  set_stmt: $ => stmt(kw("SET"), choice($.name_ref, $.name_list), "=", $._expr),

  // `CREATE [OR REPLACE] [TEMP] TABLE [IF NOT EXISTS] name [(columns)] [OPTIONS (...)] [AS query]`
  create_table_stmt: $ =>
    stmt(
      create($),
      kw("TABLE"),
      ifNotExists(),
      field("name", alias($._table_path, $.path)),
      optional($.column_list),
      optional($.options),
      optional(seq(kw("AS"), $.query)),
    ),

  // `CREATE [OR REPLACE] [TEMP] [AGGREGATE | TABLE] FUNCTION [IF NOT EXISTS] name (parameters)
  // [RETURNS type] [OPTIONS (...)] AS body [OPTIONS (...)]`
  create_function_stmt: $ =>
    stmt(
      create($),
      optional(choice(kw("AGGREGATE"), kw("TABLE"))),
      kw("FUNCTION"),
      ifNotExists(),
      field("name", $.path),
      $.param_list,
      optional($.returns_clause),
      choice(seq($.options, $.function_body), seq($.function_body, optional($.options))),
    ),

  // `CREATE {PUBLIC | PRIVATE} CONSTANT name = value`, in a module.
  create_constant_stmt: $ =>
    stmt(create($), kw("CONSTANT"), ifNotExists(), field("name", $.path), "=", $._expr),

  // `CREATE [OR REPLACE] [TEMP] EXTERNAL TABLE [IF NOT EXISTS] name [(columns)]
  // [WITH PARTITION COLUMNS [(columns)]] OPTIONS (...)`
  create_external_table_stmt: $ =>
    stmt(
      create($),
      kw("EXTERNAL"),
      kw("TABLE"),
      ifNotExists(),
      field("name", alias($._table_path, $.path)),
      optional($.column_list),
      optional($.partition_columns),
      $.options,
    ),

  // `CREATE [OR REPLACE] [TEMP] VIEW [IF NOT EXISTS] name [OPTIONS (...)] AS query`
  create_view_stmt: $ =>
    stmt(
      create($),
      kw("VIEW"),
      ifNotExists(),
      field("name", alias($._table_path, $.path)),
      optional($.options),
      kw("AS"),
      $.query,
    ),

  // `CREATE [OR REPLACE] SCHEMA [IF NOT EXISTS] name [OPTIONS (...)]`
  create_schema_stmt: $ =>
    stmt(create($), kw("SCHEMA"), ifNotExists(), field("name", $.path), optional($.options)),

  // `LOAD DATA {OVERWRITE | INTO} [TEMP TABLE] name [(columns)] [OPTIONS (...)] FROM FILES (...)
  // [WITH PARTITION COLUMNS [(columns)]]`. `TEMP` and `TEMPORARY` are a scope before `TABLE`,
  // and a table's name otherwise.
  load_data_stmt: $ =>
    stmt(
      kw("LOAD"),
      kw("DATA"),
      field("mode", choice(kw("OVERWRITE"), kw("INTO"))),
      optional(seq(field("scope", choice(kw("TEMP"), kw("TEMPORARY"))), kw("TABLE"))),
      field("name", alias(choice($._table_path, $._scope_word_path), $.path)),
      optional($.column_list),
      optional($.options),
      $.from_files,
      optional($.partition_columns),
    ),
  _scope_word_path: $ => seq(alias($._scope_word, $.name_ref), optional($._path_names)),
  _scope_word: $ => choice(kwAsName($, "TEMP"), kwAsName($, "TEMPORARY")),

  // `FROM FILES (name = value, ...)`: the options of the files that a `LOAD DATA` reads.
  from_files: $ => seq(kw("FROM"), kw("FILES"), "(", commaSep($.option_entry), ")"),

  // `WITH PARTITION COLUMNS [(columns)]`: the columns of the keys of a Hive layout's paths.
  // Right-associative, as the statements are, since it can end one.
  partition_columns: $ => prec.right(seq(kw("WITH"), kw("PARTITION"), kw("COLUMNS"), optional($.column_list))),

  // `(name type [NOT NULL], ...)`
  column_list: $ => seq("(", commaSep($.column_def), ")"),

  // `name type [NOT NULL]`
  column_def: $ => seq($.name, $._type, optional(seq(kw("NOT"), kw("NULL")))),

  // `OPTIONS (name = value, ...)`
  options: $ => seq(kw("OPTIONS"), "(", commaSep($.option_entry), ")"),

  // `name = value`. As in GoogleSQL, an option's name can also be `HASH`, `PROTO` or `PARTITION`.
  option_entry: $ => seq(alias($._option_name, $.name), "=", $._expr),
  _option_name: $ =>
    choice($.identifier, $.quoted_identifier, ...["HASH", "PROTO", "PARTITION"].map(word => kwAsName($, word))),

  // `(parameter, ...)`
  param_list: $ => seq("(", commaSep($.parameter), ")"),

  // `name type [NOT AGGREGATE]`
  parameter: $ => seq($.name, $._param_type, optional(seq(kw("NOT"), kw("AGGREGATE")))),

  _param_type: $ => choice($._type, $.any_type, $.any_table, $.table_type),

  // `ANY TYPE` and `ANY TABLE`
  any_type: $ => seq(kw("ANY"), kw("TYPE")),
  any_table: $ => seq(kw("ANY"), kw("TABLE")),

  // `TABLE<name type, ...>`
  table_type: $ => seq(kw("TABLE"), "<", commaSep($.struct_field), ">"),

  // `RETURNS type`, or `RETURNS TABLE<...>` of a table function.
  returns_clause: $ => seq(kw("RETURNS"), choice($._type, $.table_type)),

  // `AS (expression)` of a function, or `AS query` of a table function.
  function_body: $ => seq(kw("AS"), choice(seq("(", $._expr, ")"), $.query)),
};
