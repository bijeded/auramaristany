-- ============================================================
-- 013 — Allow the 'agendar' block type (A6+A7 booking)
-- The block_type CHECK constraint (last set in 004) did not include the new
-- 'agendar' block. Inserting it violated the constraint; because saveBlocks
-- deletes-then-inserts (non-atomic), the delete wiped the day's blocks before
-- the insert failed → total data loss on save. Extend the whitelist.
-- ============================================================

alter table program_day_blocks drop constraint program_day_blocks_block_type_check;
alter table program_day_blocks add constraint program_day_blocks_block_type_check
  check (block_type in ('text','youtube','pdf','image','exercise_list','cardio_zone2','agendar'));
