import type { MetadataRoute } from "next";

// PWA マニフェスト（ホーム画面追加・全画面起動）。アイコンは scripts/generate-icons.mjs で生成。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FIT·NOTE",
    short_name: "FIT·NOTE",
    description: "AI食事解析 × 極限シンプル筋トレノート",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#05070C",
    theme_color: "#05070C",
    icons: [
      // any 用ラスター
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // maskable（Android アダプティブアイコンのセーフゾーン対応）
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
