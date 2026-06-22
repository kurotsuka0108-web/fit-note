-- ============================================================================
-- FIT·NOTE  スーパーセット対応: workout_logs に group_id を追加
--
-- 同一 group_id を持つ当日ログは「スーパーセット」（交互に実施する種目の束）。
-- null = 単独種目。グループの実体は workout_logs 側のラベルのみで、
-- セット記録は従来どおり種目ごと（workout_sets）に独立して持つ。
-- ============================================================================

alter table public.workout_logs
  add column if not exists group_id uuid;

-- 同一ユーザー・同一日のグループを引くためのインデックス
create index if not exists workout_logs_group
  on public.workout_logs (user_id, date, group_id);
