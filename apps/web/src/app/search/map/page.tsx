import { Suspense } from 'react';
import SearchMapClient from './SearchMapClient';

export default function SearchMapPage() {
  return (
    <Suspense
      fallback={
        <main className="h-screen flex items-center justify-center bg-[var(--mp-bg)]">
          <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <SearchMapClient />
    </Suspense>
  );
}
