// scripts/test-analyze.mjs
//
// ルート単体を検証する。フロント不要。
// 使い方:
//   1. 別ターミナルで npm run dev を起動しておく
//   2. node scripts/test-analyze.mjs ./meal.jpg
//
// Node 18+（グローバル fetch）が必要。

import { readFile } from "node:fs/promises";
import path from "node:path";

const file = process.argv[2];
if (!file) {
  console.error("使い方: node scripts/test-analyze.mjs <画像パス>");
  process.exit(1);
}

const ext = path.extname(file).toLowerCase();
const mediaType =
  ext === ".png" ? "image/png" :
  ext === ".webp" ? "image/webp" :
  ext === ".gif" ? "image/gif" :
  "image/jpeg";

const url = process.env.ANALYZE_URL ?? "http://localhost:3000/api/analyze-meal";

const buf = await readFile(file);
const imageBase64 = buf.toString("base64");

console.log(`→ POST ${url}  (${(buf.length / 1024).toFixed(0)} KB, ${mediaType})`);

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ imageBase64, mediaType }),
});

const json = await res.json().catch(() => ({ error: "JSON でない応答" }));
console.log("status:", res.status);
console.dir(json, { depth: null });
