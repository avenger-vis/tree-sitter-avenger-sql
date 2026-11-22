MODULE charts.common;
-- <- keyword
--     ^ namespace
--            ^ namespace
IMPORT MODULE charts.helpers AS h;
--            ^ namespace
--                   ^ namespace
--                              ^ variable
DECLARE threshold, limit_ INT64 DEFAULT 10;
--      ^ variable
--                 ^ variable
--                        ^ type.builtin
SET threshold = 20;
--  ^ variable
SET (a, b) = (1, 2);
--   ^ variable
--      ^ variable
CREATE PUBLIC CONSTANT pi = 3.14;
--                     ^ variable
CREATE SCHEMA analytics;
--            ^ namespace
CREATE TEMP FUNCTION charts.scale(x FLOAT64, t ANY TYPE) RETURNS FLOAT64 AS (x * 2);
--                   ^ function
--                          ^ function
--                                ^ variable.parameter
--                                  ^ type.builtin
--                                           ^ variable.parameter
CREATE TABLE FUNCTION recent(n INT64) AS FROM t |> LIMIT n;
--                    ^ function
--                           ^ variable.parameter
CREATE TABLE my-project.sales.daily (day DATE NOT NULL, total NUMERIC(10, 2)) AS FROM t;
--           ^ type
--                      ^ type
--                            ^ type
--                                   ^ variable
--                                       ^ type.builtin
--                                                      ^ variable
--                                                            ^ type.builtin
CREATE VIEW recent_sales AS FROM sales;
--          ^ type
--                               ^ type
FROM `my-project`.sales.orders AS o JOIN customers c USING (customer_id)
--   ^ type
--                      ^ type
--                                ^ variable
--                                       ^ type
--                                                 ^ variable
--                                                          ^ variable
|> WHERE o.total > 10 AND EXTRACT(MONTH FROM o.day) = 1
--       ^ variable
--         ^ property
--                                ^ constant
--                                           ^ variable
--                                             ^ property
|> EXTEND DATE_DIFF(o.day, CURRENT_DATE, DAY) AS age, f(x).y AS z, INTERVAL 3 DAY AS gap
--        ^ function
--                         ^ function
--                                       ^ variable
--                                               ^ variable
--                                                    ^ function
--                                                         ^ property
--                                                                            ^ constant
|> EXTEND IF(a, 1, 2) AS i, SUM(x) OVER w AS s, RANK() OVER (base ORDER BY x) AS r
--        ^ function
--                          ^ function
--                                      ^ label
--                                              ^ function
--                                                           ^ label
|> AGGREGATE COUNT(*) AS n, mark_bar(x => species, range => [0, 1]) GROUP BY island AS isle
--           ^ function
--                          ^ function
--                                   ^ variable.parameter
--                                        ^ variable
--                                                 ^ variable.parameter
--                                                                           ^ variable
--                                                                                     ^ variable
|> SELECT * EXCEPT (n) REPLACE (x + 1 AS x), o.*, STRUCT<a INT64>(1 AS b) AS st
--                  ^ variable
--                              ^ variable
--                                    ^ keyword
--                                           ^ type
--                                                       ^ property
--                                                                     ^ variable
--                                                                           ^ variable
|> SET total = total * 2 |> DROP note |> RENAME old AS new_ |> AS sales_alias
--     ^ variable
--                               ^ variable
--                                              ^ variable
--                                                     ^ variable
--                                                                ^ variable
|> SELECT SUM(x) OVER v AS s WINDOW w AS (PARTITION BY region ORDER BY day), v AS w
--                    ^ label
--                                  ^ label
--                                                     ^ variable
--                                                                           ^ label
--                                                                                ^ label
|> CALL charts.top(TABLE sales, n => 3, other => TABLE extra) AS top_
--      ^ function
--             ^ function
--                       ^ type
--                              ^ variable.parameter
--                                      ^ variable.parameter
--                                                     ^ type
--                                                               ^ variable
|> WITH totals AS (FROM t) |> JOIN totals USING (k)
--      ^ type
--                                 ^ type
|> JOIN UNNEST(tags) AS tag WITH OFFSET AS pos
--             ^ variable
--             ^ variable
--                                         ^ variable
|> JOIN charts.series(start => 1) AS s
--      ^ function
--             ^ function
--                    ^ variable.parameter
|> UNPIVOT (amount FOR quarter IN (q1 AS 'Q1', (q2, q3) AS 'Q23'))
--          ^ variable
--                     ^ variable
--                                 ^ variable
--                                              ^ variable
--                                                  ^ variable
|> PIVOT (SUM(amount) AS total FOR quarter IN ('Q1' AS q1))
--        ^ function
--                       ^ variable
--                                 ^ variable
--                                                     ^ variable
|> TABLESAMPLE SYSTEM (10 PERCENT)
-- ^ keyword
--                        ^ keyword
|> EXTEND CAST(x AS ARRAY<STRUCT<k STRING>>) AS arr, t.select AS sel, t.2023 AS yr;
--                  ^ keyword
--                        ^ keyword
--                               ^ property
--                                 ^ type.builtin
--                                                     ^ property
--                                                                      ^ property
CREATE TABLE FUNCTION f(t TABLE<id INT64>) AS FROM t;
--                      ^ variable.parameter
--                              ^ variable
--                                 ^ type.builtin
