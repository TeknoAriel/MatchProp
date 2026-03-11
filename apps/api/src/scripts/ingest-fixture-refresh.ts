/**
 * Descarga el JSON externalsite de Kiteprop y guarda un subset en kiteprop-sample.min.json.
 * Ejecutar: pnpm --filter api ingest:fixture:refresh
 *
 * Requiere red. El archivo resultante se commitea para tests sin internet.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';

const DEFAULT_URL =
  'https://static.kiteprop.com/kp/difusions/4b3c894a10d905c82e85b35c410d7d4099551504/externalsite-2-9e4f284e1578b24afa155c578d05821ac4c56baa.json';
const SUBSET_SIZE = 100;
const OUTPUT = join(process.cwd(), 'src/services/ingest/fixtures/kiteprop-sample.min.json');

async function main() {
  const url = process.env.KITEPROP_EXTERNALSITE_URL || DEFAULT_URL;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
  const data = (await res.json()) as unknown[];
  const subset = Array.isArray(data) ? data.slice(0, SUBSET_SIZE) : [];
  writeFileSync(OUTPUT, JSON.stringify(subset));
  console.log(`Wrote ${subset.length} items to ${OUTPUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
