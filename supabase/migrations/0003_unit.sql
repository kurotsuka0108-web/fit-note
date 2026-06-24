-- ============================================================================
-- FIT·NOTE  時間種目対応: 記録単位 unit（reps=回数 / sec=秒数）
--
-- exercises.unit … 種目の既定の記録単位（ライブラリに記憶）
-- workout_logs.unit … その日のログの記録単位（種目の unit を引き継ぐ）
-- ============================================================================

alter table public.exercises
  add column if not exists unit text not null default 'reps';

alter table public.workout_logs
  add column if not exists unit text not null default 'reps';

-- プランクは既定で秒数記録に
update public.exercises set unit = 'sec' where name = 'プランク';
