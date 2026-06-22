"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabaseEnv } from "@/lib/env";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

/**
 * ブラウザ用 Supabase クライアントを返す。
 * env が未設定の場合は null を返し、呼び出し側（データ層）は
 * localStorage フォールバックに切り替える。
 */
export function getBrowserSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  cached = hasSupabaseEnv()
    ? createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;
  return cached;
}
