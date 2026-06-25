// 画像正規化（仕様 §3.3 / §6）。
// createImageBitmap で File を直接デコード → canvas で最大 maxDim にリサイズ → JPEG 化。
// <img>+blobURL に依存しないため HEIC・巨大画像・サンドボックス制限に強い。
// 返り値: { base64, dataUrl }（dataUrl はサムネイル表示にも流用）。

export type ProcessedImage = { base64: string; dataUrl: string };

export async function processImage(file: File, maxDim = 1024, quality = 0.85): Promise<ProcessedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("画像をデコードできませんでした（HEIC等の可能性）");
  }
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas を初期化できませんでした");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { base64: dataUrl.split(",")[1], dataUrl };
}
