#!/usr/bin/env node
/**
 * Genera photo-01.svg ... photo-24.svg en apps/web/public/demo/photos/
 * Variación de colores y etiquetas (Rosario, Funes, CABA, etc.)
 */
const fs = require('fs');
const path = require('path');

const LABELS = [
  ['Rosario', 'Depto 2 amb'],
  ['Funes', 'Casa 3 amb'],
  ['Zona norte', 'Terreno'],
  ['Centro Rosario', 'Monoambiente'],
  ['Pichincha', 'Depto 3 amb'],
  ['Barrio Martin', 'Casa 2 amb'],
  ['Recoleta', 'Ph 2 amb'],
  ['Palermo', 'Depto 1 amb'],
  ['CABA', 'Loft'],
  ['Rosario', 'Casa 4 amb'],
  ['Funes', 'Lote'],
  ['Zona norte', 'Depto 2 amb'],
  ['Centro', 'Local'],
  ['Pichincha', 'Casa'],
  ['Funes 400m2', 'Terreno'],
  ['Rosario', 'Depto 1 amb'],
  ['Cerca facultad', 'Depto 2 amb'],
  ['Palermo centro', 'Depto 3 amb'],
  ['Recoleta', 'Casa'],
  ['Rosario zona norte', 'Depto'],
  ['Funes', 'Casa 2 amb'],
  ['Barrio Martin', 'Depto'],
  ['Pichincha Rosario', 'Casa 3 amb'],
  ['Centro Rosario', 'Depto 2 amb'],
];

const GRADIENTS = [
  ['#e8d5b7', '#c4a574'],
  ['#b8d4e3', '#7eb5c8'],
  ['#9cb88a', '#6b8f5a'],
  ['#e3c9b8', '#c9a890'],
  ['#d4b8e8', '#a87ec4'],
  ['#b8e3d4', '#7ec4a8'],
  ['#e8e0b7', '#c4b874'],
  ['#e3b8b8', '#c48a8a'],
  ['#c4d4e8', '#8aa8c4'],
  ['#d8e8b7', '#a8c474'],
  ['#e8c4d4', '#c48aa0'],
  ['#b7e8e0', '#74c4b8'],
  ['#d4c4e8', '#a88ac4'],
  ['#e8d4b7', '#c4a074'],
  ['#b8e8c4', '#7ec48a'],
  ['#e3b8d4', '#c48aa8'],
  ['#c4e8d8', '#8ac4a8'],
  ['#e0b7e8', '#b874c4'],
  ['#b7c4e8', '#748ac4'],
  ['#e8b7c4', '#c4748a'],
  ['#c4e8b7', '#8ac474'],
  ['#d4e8c4', '#a8c48a'],
  ['#e8e8b7', '#c4c474'],
  ['#b7e8e8', '#74c4c4'],
];

const outDir = path.join(__dirname, '..', 'apps', 'web', 'public', 'demo', 'photos');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

for (let i = 1; i <= 24; i++) {
  const [label1, label2] = LABELS[i - 1];
  const [c1, c2] = GRADIENTS[i - 1];
  const n = String(i).padStart(2, '0');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <defs><linearGradient id="g${i}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:${c1}"/><stop offset="100%" style="stop-color:${c2}"/></linearGradient></defs>
  <rect width="400" height="300" fill="url(#g${i})"/>
  <path d="M200 70 L270 150 L270 250 L130 250 L130 150 Z" fill="rgba(255,255,255,0.25)" stroke="rgba(0,0,0,0.2)" stroke-width="2"/>
  <text x="200" y="225" text-anchor="middle" fill="rgba(0,0,0,0.6)" font-family="sans-serif" font-size="14" font-weight="bold">${label1}</text>
  <text x="200" y="245" text-anchor="middle" fill="rgba(0,0,0,0.5)" font-family="sans-serif" font-size="11">${label2}</text>
</svg>
`;
  fs.writeFileSync(path.join(outDir, `photo-${n}.svg`), svg, 'utf8');
}
console.log('24 SVGs written to', outDir);
