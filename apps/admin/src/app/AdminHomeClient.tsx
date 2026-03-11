'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AdminHomeClient() {
  const [stats, setStats] = useState<{
    listingsWithMatches: number;
    visitsUpcoming: number;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/admin/debug/crm-push/list`, { cache: 'no-store' }),
      fetch(`${API_BASE}/admin/debug/visits?limit=100&upcoming=true`, { cache: 'no-store' }),
    ])
      .then(async ([pushRes, visitsRes]) => {
        const pushRows = pushRes.ok
          ? ((await pushRes.json()) as { listingId: string; matchesCount: number }[])
          : [];
        const visitsRows = visitsRes.ok ? ((await visitsRes.json()) as unknown[]) : [];
        const uniqueWithMatches = new Set(
          pushRows.filter((r) => r.matchesCount > 0).map((r) => r.listingId)
        ).size;
        setStats({
          listingsWithMatches: uniqueWithMatches,
          visitsUpcoming: visitsRows.length,
        });
      })
      .catch(() => setStats({ listingsWithMatches: 0, visitsUpcoming: 0 }));
  }, []);

  if (stats === null) return null;

  return (
    <div className="mt-6 flex flex-wrap gap-4 justify-center">
      {stats.listingsWithMatches > 0 && (
        <Link
          href="/match-events"
          className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-800 font-medium hover:bg-emerald-200 transition-colors"
        >
          {stats.listingsWithMatches} listings con perfiles interesados
        </Link>
      )}
      {stats.visitsUpcoming > 0 && (
        <Link
          href="/visits"
          className="px-4 py-2 rounded-xl bg-blue-100 text-blue-800 font-medium hover:bg-blue-200 transition-colors"
        >
          {stats.visitsUpcoming} visitas próximas
        </Link>
      )}
    </div>
  );
}
