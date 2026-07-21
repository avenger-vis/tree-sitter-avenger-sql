WITH visible AS (
  SELECT m.category, m.value
  FROM vega.movies AS m
  WHERE m.visible = true
)
FROM visible AS v
SELECT v.category, sum(v.value) AS total
GROUP BY v.category
ORDER BY total DESC
