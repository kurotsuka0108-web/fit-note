-- ============================================================================
-- FIT·NOTE  フェーズ1 マイグレーション: 筋トレノート（NOTE）
-- 仕様 §5 のスキーマ提案に準拠。
--
-- 認証はフェーズ2の範囲のため、フェーズ1は「固定デモユーザー」で動かす。
--   - user_id は auth.users への FK を張らない（デモユーザーは未登録のため）。
--   - RLS は有効化しつつ、デモユーザーと共通テンプレ(null)に限定したポリシーを置く。
--   - フェーズ2でこのデモ用ポリシーを auth.uid() ベースに差し替える。
-- ============================================================================

-- 固定デモユーザー（lib/env.ts の DEMO_USER_ID と一致させること）
-- 00000000-0000-0000-0000-000000000001

create extension if not exists "pgcrypto";

-- ── profiles（身体情報・目標値。フェーズ2でAI算出値を保存） ─────────────────
create table if not exists public.profiles (
  id            uuid primary key,
  height        numeric,
  weight        numeric,
  age           integer,
  sex           text,
  activity_level text,
  goal          text,                       -- 増量 / 減量 / 維持
  target_kcal   integer default 2200,
  target_p      integer default 160,
  target_f      integer default 60,
  target_c      integer default 250,
  created_at    timestamptz not null default now()
);

-- ── exercises（種目ライブラリ: 共通テンプレ + ユーザー追加） ─────────────────
create table if not exists public.exercises (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,                           -- null = 共通テンプレ
  body_part  text not null,
  name       text not null,
  is_custom  boolean not null default false,
  created_at timestamptz not null default now()
);
-- 同一ユーザー(またはテンプレ)・同一部位での種目名重複を防ぐ
create unique index if not exists exercises_uniq
  on public.exercises (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), body_part, name);

-- ── workout_logs（当日の種目） ──────────────────────────────────────────────
create table if not exists public.workout_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  date        date not null,
  exercise_id uuid references public.exercises(id) on delete set null,
  name        text not null,                 -- 表示用に非正規化（種目削除後も履歴を保持）
  body_part   text not null,
  "order"     integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists workout_logs_user_date
  on public.workout_logs (user_id, date);

-- ── workout_sets（横並びセットの1チップ = 1行） ─────────────────────────────
create table if not exists public.workout_sets (
  id             uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references public.workout_logs(id) on delete cascade,
  set_index      integer not null,
  weight         numeric not null default 0,   -- 先頭段(トップセット)。bodyweight=true のときは加重量(0=純粋な自重)
  reps           integer not null default 0,
  bodyweight     boolean not null default false, -- 自重種目か
  drops          jsonb not null default '[]'::jsonb, -- 2段目以降のドロップ [{weight,reps}, ...]
  created_at     timestamptz not null default now()
);
create index if not exists workout_sets_log
  on public.workout_sets (workout_log_id);

-- ── RLS（フェーズ1: デモユーザー限定。フェーズ2で auth.uid() に差し替え） ─────
alter table public.profiles      enable row level security;
alter table public.exercises     enable row level security;
alter table public.workout_logs  enable row level security;
alter table public.workout_sets  enable row level security;

-- profiles: 本人(=デモ)のみ
drop policy if exists profiles_demo on public.profiles;
create policy profiles_demo on public.profiles
  for all
  using (id = '00000000-0000-0000-0000-000000000001'::uuid)
  with check (id = '00000000-0000-0000-0000-000000000001'::uuid);

-- exercises: 共通テンプレ(null)は読み取り可、書き込みはデモ自身の行のみ
drop policy if exists exercises_read on public.exercises;
create policy exercises_read on public.exercises
  for select
  using (user_id is null or user_id = '00000000-0000-0000-0000-000000000001'::uuid);

drop policy if exists exercises_write on public.exercises;
create policy exercises_write on public.exercises
  for insert
  with check (user_id = '00000000-0000-0000-0000-000000000001'::uuid);

drop policy if exists exercises_modify on public.exercises;
create policy exercises_modify on public.exercises
  for update using (user_id = '00000000-0000-0000-0000-000000000001'::uuid)
  with check (user_id = '00000000-0000-0000-0000-000000000001'::uuid);

drop policy if exists exercises_delete on public.exercises;
create policy exercises_delete on public.exercises
  for delete using (user_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- workout_logs: デモ自身の行のみ
drop policy if exists workout_logs_demo on public.workout_logs;
create policy workout_logs_demo on public.workout_logs
  for all
  using (user_id = '00000000-0000-0000-0000-000000000001'::uuid)
  with check (user_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- workout_sets: 親ログがデモ所有であること
drop policy if exists workout_sets_demo on public.workout_sets;
create policy workout_sets_demo on public.workout_sets
  for all
  using (exists (
    select 1 from public.workout_logs l
    where l.id = workout_log_id
      and l.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  ))
  with check (exists (
    select 1 from public.workout_logs l
    where l.id = workout_log_id
      and l.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  ));

-- ── seed: 共通テンプレ種目（仕様 §3.2 EXERCISE_LIBRARY_SEED） ────────────────
insert into public.exercises (user_id, body_part, name, is_custom) values
  (null,'胸','ベンチプレス',false),(null,'胸','ダンベルプレス',false),
  (null,'胸','インクラインプレス',false),(null,'胸','チェストフライ',false),
  (null,'胸','ディップス',false),
  (null,'背中','デッドリフト',false),(null,'背中','ラットプルダウン',false),
  (null,'背中','ベントオーバーロウ',false),(null,'背中','懸垂',false),
  (null,'背中','シーテッドロウ',false),
  (null,'肩','ショルダープレス',false),(null,'肩','サイドレイズ',false),
  (null,'肩','フロントレイズ',false),(null,'肩','リアレイズ',false),
  (null,'腕','バーベルカール',false),(null,'腕','ダンベルカール',false),
  (null,'腕','トライセプスプレスダウン',false),(null,'腕','ハンマーカール',false),
  (null,'脚','スクワット',false),(null,'脚','レッグプレス',false),
  (null,'脚','レッグエクステンション',false),(null,'脚','レッグカール',false),
  (null,'脚','カーフレイズ',false),
  (null,'体幹','プランク',false),(null,'体幹','クランチ',false),
  (null,'体幹','レッグレイズ',false),(null,'体幹','アブローラー',false)
on conflict do nothing;

-- ── seed: デモユーザーの profile（初期目標値。フェーズ2でAI算出に置換） ───────
insert into public.profiles (id, target_kcal, target_p, target_f, target_c)
values ('00000000-0000-0000-0000-000000000001'::uuid, 2200, 160, 60, 250)
on conflict (id) do nothing;
