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
  fitCircle?: boolean;
  maxDim?: number;
};

export type CircleFitPlacement = {
  minX: number;
  minY: number;
  subW: number;
  subH: number;
  outSize: number;
  dx: number;
  dy: number;
  drawW: number;
  drawH: number;
  maxRadiusRatio: number;
};

const cutoutCache = new Map<string, string>();
const fittedCircleCache = new Set<string>();
const inflightCache = new Map<string, Promise<string>>();

function cutoutCacheKey(src: string, fitCircle?: boolean) {
  return fitCircle ? `${src}::circle` : src;
}

/**
 * Compute uniform square placement so all opaque pixels sit strictly inside a
 * target circular envelope centered on the canvas (default 40% radius = 80% diameter).
 */
export function computeCircleFitPlacement(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  outSize = Math.max(width, height),
  alphaThreshold = 16,
  targetRadiusRatio = 0.4,
): CircleFitPlacement | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[rowOffset + x * 4 + 3] > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX + 4 || maxY <= minY + 4) {
    return null;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  let maxR = 0;

  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * width * 4;
    for (let x = minX; x <= maxX; x++) {
      if (data[rowOffset + x * 4 + 3] > alphaThreshold) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > maxR) maxR = dist;
      }
    }
  }

  if (maxR < 4) {
    return null;
  }

  // +1px margin accounts for pixel outer corner (+0.71px) and bilinear smoothing
  const fitScale = (outSize * targetRadiusRatio) / (maxR + 1);
  const subW = maxX - minX + 1;
  const subH = maxY - minY + 1;
  const drawW = subW * fitScale;
  const drawH = subH * fitScale;
  const dx = (outSize - drawW) / 2;
  const dy = (outSize - drawH) / 2;

  return {
    minX,
    minY,
    subW,
    subH,
    outSize,
    dx,
    dy,
    drawW,
    drawH,
    maxRadiusRatio: targetRadiusRatio,
  };
}

function encodeCanvasDataUrl(canvas: HTMLCanvasElement, quality = 0.9): string {
  const webp = canvas.toDataURL("image/webp", quality);
  return webp.startsWith("data:image/webp")
    ? webp
    : canvas.toDataURL("image/png");
}

function renderCircleFittedCanvas(
  sourceCanvas: HTMLCanvasElement,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  maxDim: number,
): string | null {
  const outSize = Math.min(maxDim, Math.max(w, h));
  const placement = computeCircleFitPlacement(w, h, data, outSize);
  if (!placement) return null;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = placement.outSize;
  outCanvas.height = placement.outSize;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) return null;

  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = "high";
  outCtx.drawImage(
    sourceCanvas,
    placement.minX,
    placement.minY,
    placement.subW,
    placement.subH,
    placement.dx,
    placement.dy,
    placement.drawW,
    placement.drawH,
  );
  return encodeCanvasDataUrl(outCanvas, 0.9);
}

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

  if (opts.removeBg === false && !opts.fitCircle) {
    return canvas.toDataURL("image/webp", 0.88);
  }

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Check if corners are already transparent (e.g. transparent PNG/WebP)
  const cornerIndices = [
    0,
    (w - 1) * 4,
    (h - 1) * w * 4,
    ((h - 1) * w + (w - 1)) * 4,
  ];
  const transparentCorners = cornerIndices.filter(
    (idx) => data[idx + 3] < 35,
  ).length;
  if (transparentCorners >= 2) {
    if (opts.fitCircle) {
      return renderCircleFittedCanvas(canvas, data, w, h, maxDim);
    }
    if (!autoTrim) {
      return null;
    }
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

  if (opts.fitCircle) {
    const cleaned = ctx.getImageData(0, 0, w, h).data;
    return (
      renderCircleFittedCanvas(canvas, cleaned, w, h, maxDim) ??
      encodeCanvasDataUrl(canvas, 0.9)
    );
  }

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
        return encodeCanvasDataUrl(outCanvas, 0.9);
      }
    }
  }

  return encodeCanvasDataUrl(canvas, 0.9);
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

export function getAutoCutoutAsync(
  src: string,
  opts?: { fitCircle?: boolean },
): Promise<string> {
  const fitCircle = Boolean(opts?.fitCircle);
  if (!src || typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(src);
  }
  const cacheKey = cutoutCacheKey(src, fitCircle);
  if (cutoutCache.has(cacheKey)) {
    return Promise.resolve(cutoutCache.get(cacheKey)!);
  }
  // Transparent PNGs in public/editorial/*-pair-v2.png or luxury-trans-* already cut out
  if (!fitCircle && /(-pair-v2\.png|luxury-trans-)/i.test(src)) {
    cutoutCache.set(cacheKey, src);
    return Promise.resolve(src);
  }
  if (inflightCache.has(cacheKey)) {
    return inflightCache.get(cacheKey)!;
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
          fitCircle,
          maxDim: 760,
        });
        const finalUrl = out || src;
        if (fitCircle && out) {
          fittedCircleCache.add(cacheKey);
        }
        cutoutCache.set(cacheKey, finalUrl);
        resolve(finalUrl);
      } catch {
        cutoutCache.set(cacheKey, src);
        resolve(src);
      } finally {
        inflightCache.delete(cacheKey);
      }
    };
    img.onerror = () => {
      cutoutCache.set(cacheKey, src);
      inflightCache.delete(cacheKey);
      resolve(src);
    };
    img.src = src;
  });

  inflightCache.set(cacheKey, promise);
  return promise;
}

export function useAutoCutout(src?: string, fitCircle = false): string {
  const safeSrc = src || "";
  const cacheKey = cutoutCacheKey(safeSrc, fitCircle);
  const [resolved, setResolved] = useState<string>(
    () => cutoutCache.get(cacheKey) || safeSrc,
  );

  useEffect(() => {
    if (!safeSrc) {
      setResolved("");
      return;
    }
    const key = cutoutCacheKey(safeSrc, fitCircle);
    if (cutoutCache.has(key)) {
      setResolved(cutoutCache.get(key)!);
      return;
    }
    let cancelled = false;
    setResolved(safeSrc);
    getAutoCutoutAsync(safeSrc, { fitCircle }).then((url) => {
      if (!cancelled) setResolved(url);
    });
    return () => {
      cancelled = true;
    };
  }, [safeSrc, fitCircle]);

  return resolved;
}

export type CutoutImgProps = ImgHTMLAttributes<HTMLImageElement> & {
  fitCircle?: boolean;
};

export function CutoutImg({
  src,
  fitCircle = false,
  ...rest
}: CutoutImgProps) {
  const safeSrc = src || "";
  const cacheKey = cutoutCacheKey(safeSrc, fitCircle);
  const resolved = useAutoCutout(src, fitCircle);
  const isCircleFitted =
    fitCircle &&
    Boolean(safeSrc) &&
    fittedCircleCache.has(cacheKey) &&
    resolved === cutoutCache.get(cacheKey);

  return createElement("img", {
    src: resolved,
    "data-cutout": "true",
    "data-circle-fitted": isCircleFitted ? "true" : undefined,
    ...rest,
  });
}

