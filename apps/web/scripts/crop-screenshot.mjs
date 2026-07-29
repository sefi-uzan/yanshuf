#!/usr/bin/env node
/**
 * Removes pure-black letterbox padding from marketing screenshots.
 * Usage: node scripts/crop-screenshot.mjs public/screenshots/capture.png
 */
const fs = require('fs');
const sharp = require('sharp');

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/crop-screenshot.mjs <image-path>');
  process.exit(1);
}

async function autoCrop(file, threshold = 35, pad = 4) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (data[i] + data[i + 1] + data[i + 2] > threshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    throw new Error('Could not detect content bounds');
  }

  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const cropW = Math.min(width - left, maxX - minX + 1 + pad * 2);
  const cropH = Math.min(height - top, maxY - minY + 1 + pad * 2);
  return { left, top, width: cropW, height: cropH };
}

(async () => {
  const box = await autoCrop(input);
  const tmp = `${input}.tmp.png`;
  await sharp(input).extract(box).png({ compressionLevel: 9 }).toFile(tmp);
  fs.renameSync(tmp, input);
  const meta = await sharp(input).metadata();
  console.log(`Cropped ${input} → ${meta.width}x${meta.height}`);
})();
