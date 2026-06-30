import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabaseEnv } from "@/lib/env";

// Next.js 16 の Proxy（旧 Middleware）。@supabase/ssr のセッショントークンを
// リクエストごとに更新し、Cookie を維持する。Supabase 未構成なら何もしない。
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!hasSupabaseEnv()) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // セッションの更新（トークンのリフレッシュ）をトリガーする。
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // 静的アセットと画像最適化を除く全パスで実行。
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"],
};
