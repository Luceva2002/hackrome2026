-- Exa: la ricerca web dell'Agente Catasto diventa una fonte come le altre.
-- Le sue proposte puntano a sources.id = 'exa_web'; l'URL di ogni campo sta in
-- field_sources.note quando l'admin approva.
alter table public.sources drop constraint if exists sources_fetcher_check;
alter table public.sources add constraint sources_fetcher_check
  check (fetcher in ('ckan', 'http_file', 'html_links', 'upload', 'exa_search'));
alter table public.sources drop constraint if exists sources_parser_check;
alter table public.sources add constraint sources_parser_check
  check (parser in ('csv', 'json', 'xlsx', 'geojson', 'pdf_llm', 'exa_output'));

insert into public.sources (id, title, publisher, url, fetcher, parser, priority, notes)
values (
  'exa_web',
  'Ricerca web (Exa) su pagine pubbliche della struttura',
  'Exa',
  'https://exa.ai',
  'exa_search',
  'exa_output',
  8,
  'Un campo è proposto solo se Exa cita almeno un URL; l''URL è nella nota del campo. Sempre da approvare in admin.'
)
on conflict (id) do nothing;
