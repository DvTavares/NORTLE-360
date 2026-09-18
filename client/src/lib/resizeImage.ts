/**
 * Redimensiona/comprime uma imagem no navegador antes do upload, para não
 * trafegar nem guardar arquivos gigantes. O lado maior fica limitado a
 * `maxSide` px, a saída é sempre JPEG e o resultado nunca passa de `maxBytes`
 * (baixa a qualidade em degraus e, se ainda passar, reduz a dimensão).
 */
export const FOTO_MAX_SIDE = 1600;
export const FOTO_QUALITY = 0.82;
export const FOTO_MAX_BYTES = 1_800_000; // ~1,8 MB — garante < 2 MB no envio/disco

export interface ResizedImage {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

/** Bytes reais de um data URL base64, sem alocar o binário. */
function dataUrlBytes(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

export async function resizeImage(
  file: File,
  maxSide = FOTO_MAX_SIDE,
  quality = FOTO_QUALITY,
  maxBytes = FOTO_MAX_BYTES,
): Promise<ResizedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("O arquivo não é uma imagem.");
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  let width: number;
  let height: number;
  let source: CanvasImageSource;

  if (bitmap) {
    width = bitmap.width;
    height = bitmap.height;
    source = bitmap;
  } else {
    // Fallback para navegadores sem createImageBitmap.
    const img = await loadImg(file);
    width = img.naturalWidth;
    height = img.naturalHeight;
    source = img;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");

  // Redesenha do original a cada tentativa (evita perda acumulada).
  const draw = (w: number, h: number, q: number): string => {
    canvas.width = w;
    canvas.height = h;
    ctx.fillStyle = "#ffffff"; // achata transparência (saída JPEG)
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", q);
  };

  const scale0 = Math.min(1, maxSide / Math.max(width, height));
  let w = Math.max(1, Math.round(width * scale0));
  let h = Math.max(1, Math.round(height * scale0));
  let q = quality;
  let dataUrl = draw(w, h, q);

  // 1) enquanto passar do limite, baixa a qualidade até 0.45
  while (dataUrlBytes(dataUrl) > maxBytes && q > 0.45) {
    q = Math.round((q - 0.12) * 100) / 100;
    dataUrl = draw(w, h, q);
  }
  // 2) se ainda passar, encolhe a dimensão em passos de 15% (piso de 900px)
  while (dataUrlBytes(dataUrl) > maxBytes && Math.max(w, h) > 900) {
    w = Math.round(w * 0.85);
    h = Math.round(h * 0.85);
    dataUrl = draw(w, h, q);
  }

  if (bitmap) bitmap.close();
  return { dataUrl, width: w, height: h, bytes: dataUrlBytes(dataUrl) };
}

function loadImg(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}
