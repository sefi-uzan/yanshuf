import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'assets/icon.svg');
const pngPath = path.join(root, 'assets/icon.png');

const svg = fs.readFileSync(svgPath, 'utf8');
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1024 },
  background: 'transparent',
});
const rendered = resvg.render();
const png = rendered.asPng();
const { width, height, pixels } = rendered;

function alphaAt(x, y) {
  const i = (y * width + x) * 4;
  return pixels[i + 3];
}

const corners = [
  alphaAt(0, 0),
  alphaAt(width - 1, 0),
  alphaAt(0, height - 1),
  alphaAt(width - 1, height - 1),
];
if (corners.some((a) => a > 8)) {
  console.warn('Warning: icon corners may not be transparent:', corners);
}

fs.writeFileSync(pngPath, png);
fs.writeFileSync(path.join(root, 'assets/icon-1024.png'), png);

console.log(`Rendered ${pngPath} (${png.length} bytes)`);
