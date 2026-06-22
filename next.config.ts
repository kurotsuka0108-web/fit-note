import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 同一LAN内のスマホ実機（LAN IP）から dev リソースへのアクセスを許可する。
  // 未設定だと Next.js 16 が cross-origin としてブロックし、hydration が走らず
  // ボタンが反応しなくなる。IP が変わったらここに追記する。
  allowedDevOrigins: ["192.168.102.4"],
};

export default nextConfig;
