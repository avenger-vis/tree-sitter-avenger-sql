// The sources of a `FROM` clause. Joins, subqueries, `UNNEST`, table functions, `PIVOT`,
// `UNPIVOT`, `TABLESAMPLE`, and `MATCH_RECOGNIZE` follow in the grammar's part on queries.

export default {
  _source: $ => $.table_source,

  // A table: `path [[AS] alias]`
  table_source: $ => seq($.path, optional($.alias)),
};
