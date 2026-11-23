--| The Typst markup and the format patterns of charts, which injections.scm injects as `avenger-typst` and `avenger-format`.
FROM penguins
|> AGGREGATE
  mark_symbol(
    x => x(bill_length_mm, axis => axis(title => '*Bill* length', labels => '%.1f')),
--                                                  ^ string
    y => y(body_mass_g, title => 'Mass'),
    color => color(species, legend => title('_Species_')),
    title => title('Penguins', subtitle => subtitle('Palmer Archipelago')),
    tools => [tooltip(title => title(species, markup => '*{}*'), fields => [field(column => 'day', format => '%Y-%m')])]
  ) AS chart,
  mark_text(x => island, y => n, text => n, format => "%'d", title => title('Plain *text*', syntax => 'plain')) AS counts
