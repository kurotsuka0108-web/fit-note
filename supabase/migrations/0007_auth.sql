-- ============================================================================
-- FIT·NOTE  フェーズ2 マイグレーション: 本格認証（Supabase Auth）
--
-- これまでの「固定デモユーザー」を廃止し、ログインした本人（auth.uid()）ごとに
-- データを分離する。RLS を auth.uid() ベースへ全面的に差し替え、各テーブルの
-- user_id 列に default auth.uid() を付ける（挿入時に本人IDが自動で入る）。
--
-- 事前にダッシュボードで以下を有効化すること:
--   Authentication → Sign In / Providers
--     - Email（メール＋パスワード。デモを滑らかにするなら "Confirm email" を OFF 推奨）
--     - Anonymous sign-ins（「ゲストとして始める」ワンクリック用）
-- ============================================================================

-- ── user_id を本人IDで自動補完（リポジトリ層は user_id を明示しなくなる） ──────
alter table public.profiles     alter column id      set default auth.uid();
alter table public.exercises     alter column user_id set default auth.uid();
alter table public.workout_logs  alter column user_id set default auth.uid();
alter table public.meals         alter column user_id set default auth.uid();
alter table public.ai_usage      alter column user_id set default auth.uid();

-- ── 旧デモ用ポリシーを破棄 ───────────────────────────────────────────────────
drop policy if exists profiles_demo     on public.profiles;
drop policy if exists exercises_read     on public.exercises;
drop policy if exists exercises_write    on public.exercises;
drop policy if exists exercises_modify   on public.exercises;
drop policy if exists exercises_delete   on public.exercises;
drop policy if exists workout_logs_demo  on public.workout_logs;
drop policy if exists workout_sets_demo  on public.workout_sets;
drop policy if exists meals_demo         on public.meals;
drop policy if exists ai_usage_demo      on public.ai_usage;

-- ── 認証ベースのポリシー（本人の行のみ。共通テンプレ exercises は全員読取可） ──
-- profiles: 本人のみ
drop policy if exists profiles_auth on public.profiles;
create policy profiles_auth on public.profiles
  for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- exercises: 共通テンプレ(null)は全員読取可、書き込みは本人の行のみ
drop policy if exists exercises_read_auth on public.exercises;
create policy exercises_read_auth on public.exercises
  for select
  using (user_id is null or user_id = auth.uid());

drop policy if exists exercises_write_auth on public.exercises;
create policy exercises_write_auth on public.exercises
  for insert
  with check (user_id = auth.uid());

drop policy if exists exercises_modify_auth on public.exercises;
create policy exercises_modify_auth on public.exercises
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists exercises_delete_auth on public.exercises;
create policy exercises_delete_auth on public.exercises
  for delete using (user_id = auth.uid());

-- workout_logs: 本人のみ
drop policy if exists workout_logs_auth on public.workout_logs;
create policy workout_logs_auth on public.workout_logs
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- workout_sets: 親ログが本人所有であること
drop policy if exists workout_sets_auth on public.workout_sets;
create policy workout_sets_auth on public.workout_sets
  for all
  using (exists (
    select 1 from public.workout_logs l
    where l.id = workout_log_id and l.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workout_logs l
    where l.id = workout_log_id and l.user_id = auth.uid()
  ));

-- meals: 本人のみ
drop policy if exists meals_auth on public.meals;
create policy meals_auth on public.meals
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ai_usage: 本人のみ
drop policy if exists ai_usage_auth on public.ai_usage;
create policy ai_usage_auth on public.ai_usage
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 新規ユーザー作成時に profiles 行を自動生成（既定の目標PFCを入れておく） ────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, target_kcal, target_p, target_f, target_c)
  values (new.id, 2200, 160, 60, 250)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
