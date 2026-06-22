import type { MetadataRoute } from "next";

// PWA マニフェスト（ホーム画面追加・全画面起動）。アイコンの作り込みはフェーズ4。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FIT·NOTE",
    short_name: "FIT·NOTE",
    description: "AI食事解析 × 極限シンプル筋トレノート",
    start_url: "/",
    display: "standalone",
    background_color: "#05070C",
    theme_color: "#05070C",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
