-- query comment
FROM vega.movies AS m
SELECT sum(m.value) AS total,
       "label",
       $config@previous:theme.color,
       E'line\nnext',
       $$raw
text$$,
       X'deadbeef',
       1.5
WHERE m.visible AND m.value >= $minimum
