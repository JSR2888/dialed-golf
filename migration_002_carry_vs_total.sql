-- Run this once in your Supabase SQL editor if you already ran the original
-- schema.sql. It renames the existing "carry_yards" column (which actually
-- measured total distance, since that's all GPS start/end points can give
-- you) to "total_yards", and adds a new nullable "carry_yards" column for
-- optional manual entry.
--
-- Safe to skip if you're setting up a brand new project — schema.sql already
-- has the corrected column names.

alter table shots rename column carry_yards to total_yards;
alter table shots add column carry_yards numeric;
