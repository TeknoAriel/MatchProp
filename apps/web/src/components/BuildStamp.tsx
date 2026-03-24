/** Muestra el SHA corto del build (Vercel) para verificar que ves el deploy actual. */
export function BuildStamp() {
  const full = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_APP_VERSION ?? '';
  const short = full ? full.slice(0, 7) : 'local';
  return (
    <div
      className="fixed bottom-16 md:bottom-1 left-0 right-0 z-[1] text-center text-[10px] text-neutral-500/35 dark:text-neutral-400/30 select-none pointer-events-none tabular-nums"
      title={`Build ${full || 'local'}`}
      aria-hidden
    >
      {short}
    </div>
  );
}
