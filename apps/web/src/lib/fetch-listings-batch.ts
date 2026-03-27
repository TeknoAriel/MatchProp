/**
 * Una sola petición para hidratar varias fichas (reemplaza N× GET /listings/:id).
 */
export async function fetchListingsBatchByIds(
  apiBase: string,
  ids: string[],
  credentials: RequestCredentials = 'include'
): Promise<unknown[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const res = await fetch(`${apiBase}/listings/batch?ids=${encodeURIComponent(unique.join(','))}`, {
    credentials,
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: unknown[] };
  return Array.isArray(data.items) ? data.items : [];
}
