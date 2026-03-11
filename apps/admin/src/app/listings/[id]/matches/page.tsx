/**
 * Sprint 10: UX mínima — Ver perfiles interesados para un listing.
 * GET /admin/listings/:id/matches (admin app); datos desde API /admin/debug/listings/:id/matches.
 */
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Props = { params: Promise<{ id: string }> };

export default async function ListingMatchesPage({ params }: Props) {
  const { id } = await params;
  let matchesCount = 0;
  let topSearchIds: string[] = [];
  let error: string | null = null;

  try {
    const res = await fetch(`${API_BASE}/admin/debug/listings/${id}/matches`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      matchesCount = data.matchesCount ?? 0;
      topSearchIds = Array.isArray(data.topSearchIds) ? data.topSearchIds : [];
    } else {
      error = `API ${res.status}`;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="min-h-screen p-6">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-4 text-xl font-bold">Listing {id}</h1>
      {error && <p className="mt-2 text-red-600">Error: {error}</p>}
      {!error && (
        <>
          <p className="mt-4 text-lg">
            {matchesCount > 0
              ? `✅ Se detectaron ${matchesCount} perfil${matchesCount === 1 ? '' : 'es'} interesado${matchesCount === 1 ? '' : 's'}.`
              : 'Sin perfiles interesados registrados para este listing.'}
          </p>
          {matchesCount > 0 && (
            <a href="#top-search-ids" className="mt-2 inline-block text-blue-600 hover:underline">
              Ver interesados ↓
            </a>
          )}
          {topSearchIds.length > 0 && (
            <ul id="top-search-ids" className="mt-2 list-inside list-disc text-gray-700">
              {topSearchIds.map((sid) => (
                <li key={sid}>{sid}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
