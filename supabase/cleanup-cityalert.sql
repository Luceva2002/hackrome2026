-- Rimuove le tabelle e le funzioni di CityAlert (segnalazioni, voti, commenti,
-- gamification). IRREVERSIBILE: eseguilo solo su un database dedicato a RomaInCampo.
drop view if exists public.civic_reports_feed;
drop function if exists public.award_report(uuid);
drop table if exists public.report_comments;
drop table if exists public.report_votes;
drop table if exists public.civic_reports;
alter table public.profiles drop column if exists xp;
alter table public.profiles drop column if exists coins;
alter table public.profiles drop column if exists level;
