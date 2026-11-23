--| The penguins of the Palmer archipelago.
-- <- comment.doc
FROM penguins  # one line
-- <- keyword
--             ^ comment
|> EXTEND 'it''s' AS a, "tab\t" AS b, r'raw\n' AS c, b'\x01' AS d, '''long''' AS e
--        ^ string
--                          ^ string.escape
--                                    ^ string
--                                                   ^ string
--                                                     ^ string.escape
--                                                                 ^ string
|> EXTEND 'one' 'two' AS f, DATE '2024-01-01' AS g, JSON '{"a": 1}' AS h
--        ^ string
--              ^ string
--                          ^ keyword
--                               ^ string
--                                ^ string.special
--                                                  ^ keyword
--                                                       ^ string
|> EXTEND TIME '12:30:00' AS t1, DATETIME '2024-01-01 12:30:00.5' AS t2, TIMESTAMP '2024-01-01T12:30:00+05:30' AS t3
--              ^ string.special
--                                         ^ string.special
--                                                                                  ^ string.special
|> EXTEND RANGE<DATE> '[2024-01-01, 2025-01-01)' AS r, NUMERIC '1.25' AS n1, BIGNUMERIC '-3e40' AS n2
--                     ^ string.special
--                                                              ^ number
--                                                                                       ^ number
|> EXTEND 10 AS i, 0x1F AS j, 1.5e3 AS k, .5 AS l, TRUE AS m, FALSE AS n, NULL AS o
--        ^ number
--                 ^ number
--                            ^ number
--                             ^ number
--                                                 ^ boolean
--                                                            ^ boolean
--                                                                        ^ constant.builtin
|> WHERE mass > @threshold AND sex = ? AND x IS NOT TRUE /* block */
--              ^ variable.special
--                                   ^ variable.special
--                                           ^ keyword
--                                              ^ keyword
--                                                  ^ boolean
--                                                       ^ comment
|> SELECT @{hint} 1 AS p;
--        ^ comment
LOAD DATA INTO sales FROM FILES (format = 'CSV', uris = ['data/a.csv', 'data/b.csv'], skip = '1');
--                               ^ property
--                                         ^ string.special
--                                               ^ property
--                                                        ^ string
--                                                                      ^ string
--                                                                                    ^ property
--                                                                                           ^ string
CREATE EXTERNAL TABLE trips OPTIONS (format = 'PARQUET', uris = ['trips/*.parquet'], label = 'x');
--                                             ^ string.special
--                                                                ^ string
--                                                                                           ^ string
CREATE TABLE notes OPTIONS (format = 'plain') AS FROM t;
--                                   ^ string
