// 環境変数の集約。Supabase キーが未設定でも動くよう、存在判定をここに集約する。
// （未設定時はデータ層が localStorage フォールバックに切り替わる — lib/db を参照）

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Supabase 連携が構成済みか（URL と anon key の両方が揃っているか） */
export const hasSupabaseEnv = (): boolean =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// フェーズ1は固定デモユーザーで永続化する（本格認証は仕様フェーズ2）。
// Supabase 移行時は profiles / 各テーブルの user_id にこの値を用いる。
export const DEMO_USER_ID =
  process.env.NEXT_PUBLIC_DEMO_USER_ID ??
  "00000000-0000-0000-0000-000000000001";
