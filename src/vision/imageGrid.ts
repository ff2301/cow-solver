import type { CowPuzzle, CropBounds } from "../core/types";

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export const defaultCrop: CropBounds = {
  left: 0.035,
  top: 0.312,
  width: 0.93,
  height: 0.432
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image failed to load"));
    image.src = url;
  });
}

function distance(a: Rgb, b: Rgb): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function toHex(color: Rgb): string {
  const part = (value: number) => Math.round(value).toString(16).padStart(2, "0");
  return `#${part(color.r)}${part(color.g)}${part(color.b)}`;
}

function averagePatch(data: ImageData, x0: number, y0: number, size: number): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  const half = Math.max(1, Math.floor(size / 2));
  for (let y = Math.max(0, y0 - half); y < Math.min(data.height, y0 + half); y += 1) {
    for (let x = Math.max(0, x0 - half); x < Math.min(data.width, x0 + half); x += 1) {
      const index = (y * data.width + x) * 4;
      r += data.data[index];
      g += data.data[index + 1];
      b += data.data[index + 2];
      count += 1;
    }
  }
  return { r: r / count, g: g / count, b: b / count };
}

function clusterColors(samples: Rgb[], threshold: number): { ids: string[]; colors: Record<string, string> } {
  const centers: Rgb[] = [];
  const ids: string[] = [];

  for (const sample of samples) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    centers.forEach((center, index) => {
      const value = distance(center, sample);
      if (value < bestDistance) {
        bestDistance = value;
        bestIndex = index;
      }
    });

    if (bestIndex === -1 || bestDistance > threshold) {
      centers.push(sample);
      ids.push(`c${centers.length}`);
    } else {
      centers[bestIndex] = {
        r: centers[bestIndex].r * 0.75 + sample.r * 0.25,
        g: centers[bestIndex].g * 0.75 + sample.g * 0.25,
        b: centers[bestIndex].b * 0.75 + sample.b * 0.25
      };
      ids.push(`c${bestIndex + 1}`);
    }
  }

  const colors = Object.fromEntries(centers.map((center, index) => [`c${index + 1}`, toHex(center)]));
  return { ids, colors };
}

export async function samplePuzzleFromImage(
  imageUrl: string,
  rows: number,
  cols: number,
  crop: CropBounds,
  threshold = 42
): Promise<CowPuzzle> {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

  const left = crop.left * canvas.width;
  const top = crop.top * canvas.height;
  const cellWidth = (crop.width * canvas.width) / cols;
  const cellHeight = (crop.height * canvas.height) / rows;
  const patch = Math.min(cellWidth, cellHeight) * 0.35;
  const samples: Rgb[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = Math.round(left + (col + 0.5) * cellWidth);
      const y = Math.round(top + (row + 0.5) * cellHeight);
      samples.push(averagePatch(imageData, x, y, patch));
    }
  }

  const clustered = clusterColors(samples, threshold);
  const grid = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => clustered.ids[row * cols + col])
  );

  return {
    rows,
    cols,
    colors: clustered.colors,
    grid,
    requireOnePerRow: true,
    requireOnePerCol: true
  };
}
