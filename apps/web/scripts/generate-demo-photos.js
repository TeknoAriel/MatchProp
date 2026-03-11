#!/usr/bin/env node
/**
 * Genera photo-01.svg .. photo-50.svg en public/demo/photos/ (Sprint 14)
 * Ejecutar desde repo root: node apps/web/scripts/generate-demo-photos.js
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '../public/demo/photos');
const LABELS = [
  'Rosario',
  'Funes',
  'Zona norte',
  'Pichincha',
  'Centro',
  'Barrio Martin',
  'Cerca facultad',
  'Recoleta',
  'Palermo',
  'CABA',
  'Santa Fe',
  'Rosario centro',
  'Funes 400m2',
  'Zona sur',
  'Norte CABA',
  'Rosario norte',
  'Pichincha',
  'Centro',
  'Martin',
  'Facultad',
  'Recoleta',
  'Palermo centro',
  'CABA norte',
  'Santa Fe',
];
const COLORS = [
  ['#4a7c59', '#2d5a3d'],
  ['#6b8cae', '#4a6b8a'],
  ['#8b7355', '#5c4a32'],
  ['#7a9eb8', '#3d6b8a'],
  ['#5a8f7a', '#2e5c4a'],
  ['#6a6a8e', '#3d3d5c'],
  ['#9a7b5a', '#5c4a35'],
  ['#5c7a9a', '#3d5a7a'],
  ['#7a6a9a', '#4a3d6a'],
  ['#8a9a6a', '#5c6a3d'],
  ['#6a8a7a', '#3d5a4a'],
  ['#9a6a7a', '#5c3d4a'],
  ['#4a6a8a', '#2d4a6a'],
  ['#8a6a4a', '#5c4a2d'],
  ['#6a8a4a', '#4a5c2d'],
  ['#8a4a6a', '#5c2d4a'],
  ['#4a8a6a', '#2d5c4a'],
  ['#7a5a8a', '#4a3d5c'],
  ['#5a8a7a', '#3d5c4a'],
  ['#8a7a5a', '#5c4a3d'],
  ['#6a5a8a', '#4a3d5c'],
  ['#8a5a6a', '#5c3d4a'],
  ['#5a6a8a', '#3d4a5c'],
  ['#7a8a5a', '#4a5c3d'],
];

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

for (let i = 1; i <= 50; i++) {
  const [c1, c2] = COLORS[(i - 1) % COLORS.length];
  const label = LABELS[(i - 1) % LABELS.length];
  const n = String(i).padStart(2, '0');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <defs><linearGradient id="g${i}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:${c1}"/><stop offset="100%" style="stop-color:${c2}"/></linearGradient></defs>
  <rect width="400" height="300" fill="url(#g${i})"/>
  <rect x="140" y="95" width="120" height="100" rx="4" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
  <text x="200" y="250" text-anchor="middle" fill="rgba(255,255,255,0.95)" font-family="sans-serif" font-size="18">${label}</text>
</svg>
`;
  fs.writeFileSync(path.join(DIR, `photo-${n}.svg`), svg);
}
console.log('Generated 50 demo photos in', DIR);
