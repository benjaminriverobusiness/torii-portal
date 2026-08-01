-- Adds fields required to match Raúl's Google Sheet CRM columns in the Ventas page.
-- Safe to run multiple times / against a table that already has some of these columns.

alter table client_closer_calls
  add column if not exists ad_id text,
  add column if not exists calificaba boolean,
  add column if not exists situacion_resultado text,
  add column if not exists hijos_casado text;
