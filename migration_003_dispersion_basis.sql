-- Run once if you already applied migration_002_carry_vs_total.sql.
-- Lets a shot be logged with only a carry number and no known total (e.g.
-- marking landing spot on a screen at a simulator/Topgolf bay, where you
-- can't walk out to the actual resting spot).

alter table shots alter column total_yards drop not null;

alter table shots
  add column dispersion_basis text not null default 'total'
  check (dispersion_basis in ('total', 'carry'));

alter table shots
  add constraint shots_total_or_carry_present
  check (total_yards is not null or carry_yards is not null);
