--| The regular expressions of the regex functions, which injections.scm injects as `regex`.
FROM people
|> WHERE REGEXP_CONTAINS(city, r'^[A-Z]\w+$')
--       ^ function
--                             ^ string
|> SELECT
  regexp_extract(email, '@(.+)') AS domain,
  REGEXP_REPLACE(phone, r'(\d{3})-(\d{4})', r'\1\2') AS digits,
  REGEXP_REPLACE(code, '\\d+', '#') AS masked,
  REGEXP_EXTRACT_ALL(tags, r'#(\w+)') AS hashtags,
  REGEXP_EXTRACT_GROUPS(code, r'(?<n__INT64>\d+)') AS numbers,
  REGEXP_INSTR(email, '@', 1, 1) AS at_sign,
  REGEXP_MATCH(city, '^S') AS s,
  REGEXP_SUBSTR(phone, r'\d{4}$') AS last4,
  CONCAT(city, '^not a regex$') AS other
