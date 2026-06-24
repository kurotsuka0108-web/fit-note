-- ============================================================================
-- FIT·NOTE  種目ごとの既定インターバルを記憶
--
-- exercises.interval_sec … その種目を次に追加したときの既定インターバル秒。
-- （共通テンプレ=user_id null は RLS で更新不可のため、ユーザー所有種目のみ更新可）
-- ============================================================================

alter table public.exercises
  add column if not exists interval_sec integer not null default 60;
