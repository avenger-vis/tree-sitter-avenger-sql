FROM catalog.schema.movies AS m
LEFT JOIN catalog.schema.ratings AS r ON m.id = r.movie_id
SELECT m.id,
       m.title,
       m.category,
       m.release_year,
       m.runtime,
       m.budget,
       m.revenue,
       m.rating,
       m.votes,
       coalesce(r.critic_score, 0) AS critic_score,
       coalesce(r.audience_score, 0) AS audience_score,
       sum(m.revenue) OVER (PARTITION BY m.category ORDER BY m.release_year) AS running_revenue,
       avg(m.rating) OVER (PARTITION BY m.category) AS category_rating,
       CASE WHEN m.rating >= 8 THEN 'high' WHEN m.rating >= 6 THEN 'medium' ELSE 'low' END AS rating_band
WHERE m.release_year >= $minimum_year
  AND m.visible = true
  AND m.category NOT IN ('unknown', 'other')
GROUP BY m.id,
         m.title,
         m.category,
         m.release_year,
         m.runtime,
         m.budget,
         m.revenue,
         m.rating,
         m.votes,
         r.critic_score,
         r.audience_score
HAVING count(*) > 0
ORDER BY m.category, m.release_year DESC, m.title
LIMIT 1000
