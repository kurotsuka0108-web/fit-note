import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabaseEnv } from "@/lib/env";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * サーバー（Server Component / Route Handler / Server Action）用 Supabase クライアント。
 * env が未設定なら null を返す。フェーズ3以降のサーバー側日次カウント等で使用。
 */
export async function getServerSupabase(): Promise<SupabaseClient | null> {
  if (!hasSupabaseEnv()) return null;
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component からの set は無視（middleware で更新される想定）
        }
      },
    },
  });
}
