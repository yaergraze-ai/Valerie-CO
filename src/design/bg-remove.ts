import {
  createElement,
  useEffect,
  useState,
  type ImgHTMLAttributes,
} from "react";

export type BgRemoveOptions = {
  removeBg?: boolean;
  tolerance?: number;
  autoTrim?: boolean;
  maxDim?: number;
};

const cutoutCache = new Map<string, string>();
const inflightCache = new Map<string, Promise<string>>();

function colorDist(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11) * 1.65;
}

function median(values: number[]) {
  if (!values.length) return 255;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function removeBackgroundFromImageElement(
  img: HTMLImageElement,
  opts: BgRemoveOptions = {},
): string | null {
  const maxDim = opts.maxDim ?? 840;
  const tolerance = opts.tolerance ?? 30;
  const autoTrim = opts.autoTrim ?? false;

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) return null;

  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, w, h);

  if (opts.removeBg === false) {
    return canvas.toDataURL("image/webp", 0.88);
  }

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Check if corners are already transparent (e.g. transparent PNG)
  const cornerIndices = [
    0,
    (w - 1) * 4,
    (h - 1) * w * 4,
    ((h - 1) * w + (w - 1)) * 4,
  ];
  const transparentCorners = cornerIndices.filter(
    (idx) => data[idx + 3] < 35,
  ).length;
  if (transparentCorners >= 2 && !autoTrim) {
    return null;
  }

  // Sample border perimeter to estimate dominant studio backdrop color
  const samplesR: number[] = [];
  const samplesG: number[] = [];
  const samplesB: number[] = [];
  const stepX = Math.max(1, Math.floor(w / 24));
  const stepY = Math.max(1, Math.floor(h / 24));

  const pushSample = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (data[i + 3] > 200) {
      samplesR.push(data[i]);
      samplesG.push(data[i + 1]);
      samplesB.push(data[i + 2]);
    }
  };

  for (let x = 0; x < w; x += stepX) {
    pushSample(x, 0);
    pushSample(x, Math.min(h - 1, 2));
    pushSample(x, h - 1);
  }
  for (let y = 0; y < h; y += stepY) {
    pushSample(0, y);
    pushSample(w - 1, y);
  }

  const bgR = median(samplesR);
  const bgG = median(samplesG);
  const bgB = median(samplesB);

  const totalPixels = w * h;
  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  const maxBgDist = tolerance * 1.35;
  const maxStepDiff = Math.max(7, Math.round(tolerance * 0.34));

  const trySeed = (x: number, y: number) => {
    const idx = y * w + x;
    if (visited[idx]) return;
    const p = idx * 4;
    if (data[p + 3] < 35) {
      visited[idx] = 1;
      queue[tail++] = idx;
      return;
    }
    const d = colorDist(data[p], data[p + 1], data[p + 2], bgR, bgG, bgB);
    if (d <= maxBgDist * 1.15) {
      visited[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < w; x++) {
    trySeed(x, 0);
    trySeed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    trySeed(0, y);
    trySeed(w - 1, y);
  }

  const dirs = [-1, 1, -w, w, -w - 1, -w + 1, w - 1, w + 1];

  while (head < tail) {
    const curr = queue[head++];
    const cx = curr % w;
    const cp = curr * 4;
    const cr = data[cp];
    const cg = data[cp + 1];
    const cb = data[cp + 2];

    for (let d = 0; d < 8; d++) {
      const next = curr + dirs[d];
      if (next < 0 || next >= totalPixels || visited[next]) continue;
      const nx = next % w;
      if (Math.abs(nx - cx) > 1) continue;

      const np = next * 4;
      const nr = data[np];
      const ng = data[np + 1];
      const nb = data[np + 2];

      const stepDiff = Math.max(
        Math.abs(nr - cr),
        Math.abs(ng - cg),
        Math.abs(nb - cb),
      );
      if (stepDiff > maxStepDiff) continue;

      const distToBg = colorDist(nr, ng, nb, bgR, bgG, bgB);
      if (distToBg <= maxBgDist) {
        visited[next] = 1;
        queue[tail++] = next;
      }
    }
  }

  // Clear flood-filled background pixels
  for (let i = 0; i < totalPixels; i++) {
    if (visited[i] === 1) {
      data[i * 4 + 3] = 0;
    }
  }

  // Anti-aliased edge feathering & background color decontamination (2-pass ring)
  const featherOuter = maxBgDist * 1.65;
  const featherInner = maxBgDist * 0.45;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (visited[idx] === 1) continue;

      const touchesBg =
        visited[idx - 1] === 1 ||
        visited[idx + 1] === 1 ||
        visited[idx - w] === 1 ||
        visited[idx + w] === 1 ||
        visited[idx - w - 1] === 1 ||
        visited[idx - w + 1] === 1 ||
        visited[idx + w - 1] === 1 ||
        visited[idx + w + 1] === 1;

      if (!touchesBg) continue;

      const p = idx * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const dist = colorDist(r, g, b, bgR, bgG, bgB);

      if (dist < featherOuter) {
        const ratio = Math.max(
          0,
          Math.min(
            1,
            (dist - featherInner) / Math.max(1, featherOuter - featherInner),
          ),
        );
        const newAlpha = Math.round(data[p + 3] * ratio);
        data[p + 3] = newAlpha;

        // Unmix background halo from edge RGB
        if (ratio > 0.12 && ratio < 0.95) {
          const inv = 1 - ratio;
          data[p] = Math.max(0, Math.min(255, Math.round((r - bgR * inv) / ratio)));
          data[p + 1] = Math.max(
            0,
            Math.min(255, Math.round((g - bgG * inv) / ratio)),
          );
          data[p + 2] = Math.max(
            0,
            Math.min(255, Math.round((b - bgB * inv) / ratio)),
          );
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  if (autoTrim) {
    let minX = w,
      minY = h,
      maxX = 0,
      maxY = 0;
    let found = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 24) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }
    if (found && maxX > minX + 10 && maxY > minY + 10) {
      const subW = maxX - minX + 1;
      const subH = maxY - minY + 1;
      const outSize = Math.round(Math.max(subW, subH) * 1.16);
      const outCanvas = document.createElement("canvas");
      outCanvas.width = outSize;
      outCanvas.height = Math.round(outSize * 0.86);
      const outCtx = outCanvas.getContext("2d");
      if (outCtx) {
        const fitScale = Math.min(
          (outCanvas.width * 0.86) / subW,
          (outCanvas.height * 0.84) / subH,
        );
        const drawW = Math.round(subW * fitScale);
        const drawH = Math.round(subH * fitScale);
        const dx = Math.round((outCanvas.width - drawW) / 2);
        const dy = Math.round((outCanvas.height - drawH) / 2);
        outCtx.drawImage(canvas, minX, minY, subW, subH, dx, dy, drawW, drawH);
        const webp = outCanvas.toDataURL("image/webp", 0.9);
        return webp.startsWith("data:image/webp")
          ? webp
          : outCanvas.toDataURL("image/png");
      }
    }
  }

  const webp = canvas.toDataURL("image/webp", 0.9);
  return webp.startsWith("data:image/webp")
    ? webp
    : canvas.toDataURL("image/png");
}

export function processUploadedProductPhoto(
  file: File,
  opts: BgRemoveOptions = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = () => {
      const rawDataUrl = String(reader.result);
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image file"));
      img.onload = () => {
        const result = removeBackgroundFromImageElement(img, {
          removeBg: opts.removeBg ?? true,
          tolerance: opts.tolerance ?? 34,
          autoTrim: opts.autoTrim ?? true,
          maxDim: opts.maxDim ?? 860,
        });
        resolve(result || rawDataUrl);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function getAutoCutoutAsync(src: string): Promise<string> {
  if (!src || typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(src);
  }
  if (cutoutCache.has(src)) {
    return Promise.resolve(cutoutCache.get(src)!);
  }
  // Transparent PNGs in public/editorial/*-pair-v2.png or data:image/webp|png already cut out
  if (/(-pair-v2\.png|luxury-trans-)/i.test(src)) {
    cutoutCache.set(src, src);
    return Promise.resolve(src);
  }
  if (inflightCache.has(src)) {
    return inflightCache.get(src)!;
  }

  const promise = new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const out = removeBackgroundFromImageElement(img, {
          removeBg: true,
          tolerance: 28,
          autoTrim: false,
          maxDim: 760,
        });
        const finalUrl = out || src;
        cutoutCache.set(src, finalUrl);
        resolve(finalUrl);
      } catch {
        cutoutCache.set(src, src);
        resolve(src);
      } finally {
        inflightCache.delete(src);
      }
    };
    img.onerror = () => {
      cutoutCache.set(src, src);
      inflightCache.delete(src);
      resolve(src);
    };
    img.src = src;
  });

  inflightCache.set(src, promise);
  return promise;
}

export function useAutoCutout(src?: string): string {
  const safeSrc = src || "";
  const [resolved, setResolved] = useState<string>(
    () => cutoutCache.get(safeSrc) || safeSrc,
  );

  useEffect(() => {
    if (!safeSrc) {
      setResolved("");
      return;
    }
    if (cutoutCache.has(safeSrc)) {
      setResolved(cutoutCache.get(safeSrc)!);
      return;
    }
    let cancelled = false;
    setResolved(safeSrc);
    getAutoCutoutAsync(safeSrc).then((url) => {
      if (!cancelled) setResolved(url);
    });
    return () => {
      cancelled = true;
    };
  }, [safeSrc]);

  return resolved;
}

export function CutoutImg({
  src,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement>) {
  const resolved = useAutoCutout(src);
  return createElement("img", {
    src: resolved,
    "data-cutout": "true",
    ...rest,
  });
}

