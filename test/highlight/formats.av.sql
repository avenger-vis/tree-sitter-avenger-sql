--| The formats of the functions that format and parse, which injections.scm injects as `avenger-format`.
FROM orders
|> EXTEND
  FORMAT_DATE('%Y-%m-%d', day) AS iso,
--^ function
--            ^ string
  format_timestamp(r'%E4Y %Ez', at_time) AS stamped,
  PARSE_DATE('%d/%m/%Y', raw_day) AS parsed,
  FORMAT_TIME('%H:%M', clock) AS hm,
  FORMAT_DATETIME('%b %e', moment) AS short,
  PARSE_TIMESTAMP('%Y%m%d %H%M%S', raw_time) AS parsed_time,
  FORMAT("%'.2f%%", share) AS percent,
  CONCAT('%Y', city) AS other
