'use client';

export function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-sm animate-pulse">
      <div className="aspect-video bg-slate-200" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-slate-200 rounded w-3/4" />
        <div className="h-4 bg-slate-200 rounded w-1/2" />
        <div className="h-3 bg-slate-200 rounded w-2/3" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonListingDetail() {
  return (
    <div className="max-w-lg mx-auto space-y-4 animate-pulse">
      <div className="aspect-video bg-slate-200 rounded-2xl" />
      <div className="p-4 space-y-3">
        <div className="h-6 bg-slate-200 rounded w-2/3" />
        <div className="h-5 bg-slate-200 rounded w-1/3" />
        <div className="h-4 bg-slate-200 rounded w-full" />
        <div className="h-4 bg-slate-200 rounded w-4/5" />
        <div className="flex gap-4 mt-4">
          <div className="h-4 bg-slate-200 rounded w-16" />
          <div className="h-4 bg-slate-200 rounded w-16" />
          <div className="h-4 bg-slate-200 rounded w-20" />
        </div>
      </div>
    </div>
  );
}
