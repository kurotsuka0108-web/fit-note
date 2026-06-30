// PWA アイコン生成（フェーズ4-A）。
// マスター画像 scripts/icon-source.png（FIT·NOTE ノートブックアイコン）から各サイズを書き出す。
// 実行: node scripts/generate-icons.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "scripts", "icon-source.png");
const PUBLIC = join(ROOT, "public");

// マスター画像の背景色（角のサンプル）。maskable / apple 合成時の余白に使う。
const BG = { r: 8, g: 8, b: 8 };

// そのままリサイズ（any 用。元画像は黒背景の正方形）
async function resized(size, out) {
  await sharp(SRC).resize(size, size, { fit: "cover" }).png().toBuffer()
    .then((buf) => sharp(buf).toFile(join(PUBLIC, out)));
  console.log("  ✓", out, `(${size}px)`);
}

// maskable: OS がセーフゾーン外をマスクするため、ロゴを内側 ~82% に縮めて黒で縁取る
async function maskable(size, out, scale = 0.82) {
  const inner = Math.round(size * scale);
  const logo = await sharp(SRC).resize(inner, inner, { fit: "cover" }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 3, background: BG } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(join(PUBLIC, out));
  console.log("  ✓", out, `(${size}px, scale ${scale})`);
}

// apple-touch: 不透明（黒背景でフラット化）。iOS が角丸を付与
async function apple(size, out) {
  await sharp(SRC).resize(size, size, { fit: "cover" }).flatten({ background: BG }).png()
    .toFile(join(PUBLIC, out));
  console.log("  ✓", out, `(${size}px)`);
}

async function main() {
  await resized(192, "icon-192.png");
  await resized(512, "icon-512.png");
  await maskable(512, "icon-maskable.png");
  await apple(180, "apple-touch-icon.png");
  await resized(32, "favicon.png");
  console.log("done.");
}

main();
