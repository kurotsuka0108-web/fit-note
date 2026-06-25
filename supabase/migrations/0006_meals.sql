-- ============================================================================
-- FIT·NOTE  フェーズ3 マイグレーション: SHOKUJI（AI食事ダッシュボード）
-- 仕様 §3.3 / §5 の meals・ai_usage スキーマに準拠。
--
-- 認証はフェーズ2の範囲のため、フェーズ1〜3は「固定デモユーザー」で動かす。
--   - RLS は有効化しつつ、デモユーザーに限定したポリシーを置く。
--   - フェーズ2でこのデモ用ポリシーを auth.uid() ベースに差し替える。
-- ============================================================================

-- 固定デモユーザー: 00000000-0000-0000-0000-000000000001（lib/env.ts と一致）

-- ── meals（食事記録） ───────────────────────────────────────────────────────
create table if not exists public.meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  date       date not null,
  dish       text not null,
  kcal       integer not null default 0,
  p          integer not null default 0,   -- タンパク質 (g)
  f          integer not null default 0,   -- 脂質 (g)
  c          integer not null default 0,   -- 炭水化物 (g)
  image_path text,                          -- Supabase Storage パス/URL（フェーズ4で本対応）
  source     text not null default 'manual', -- ai / manual
  created_at timestamptz not null default now()
);
create index if not exists meals_user_date
  on public.meals (user_id, date);

-- ── ai_usage（無料プラン日次カウント。サーバー側で判定・インクリメント） ──────
create table if not exists public.ai_usage (
  user_id    uuid not null,
  date       date not null,
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- ── RLS（デモユーザー限定。フェーズ2で auth.uid() に差し替え） ────────────────
alter table public.meals    enable row level security;
alter table public.ai_usage enable row level security;

-- meals: デモ自身の行のみ
drop policy if exists meals_demo on public.meals;
create policy meals_demo on public.meals
  for all
  using (user_id = '00000000-0000-0000-0000-000000000001'::uuid)
  with check (user_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- ai_usage: デモ自身の行のみ
drop policy if exists ai_usage_demo on public.ai_usage;
create policy ai_usage_demo on public.ai_usage
  for all
  using (user_id = '00000000-0000-0000-0000-000000000001'::uuid)
  with check (user_id = '00000000-0000-0000-0000-000000000001'::uuid);
