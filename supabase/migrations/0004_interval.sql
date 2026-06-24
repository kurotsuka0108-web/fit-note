-- ============================================================================
-- FIT·NOTE  インターバル（休憩）タイマー対応
--
-- workout_logs.interval_sec … セット間インターバル秒（0=タイマー無し）。
-- 秒数種目はセット完了が START になり実施タイマー、回数種目は完了後に休憩タイマー。
-- ============================================================================

alter table public.workout_logs
  add column if not exists interval_sec integer not null default 60;
