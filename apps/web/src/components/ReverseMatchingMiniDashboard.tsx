'use client';

/** Mini-dashboard estilo Quick Stats (KiteProp) para Reverse Matching */
interface ReverseMatchingMiniDashboardProps {
  matchesCount: number;
  topSearchIds?: string[];
  adminUrl?: string;
  /** Solo visible para agentes/admin */
  visible?: boolean;
}

export default function ReverseMatchingMiniDashboard({
  matchesCount,
  topSearchIds = [],
  adminUrl,
  visible = true,
}: ReverseMatchingMiniDashboardProps) {
  if (!visible || matchesCount === 0) return null;

  return (
    <div className="card-base p-4 mb-4">
      <h3 className="text-sm font-semibold text-[var(--mp-foreground)] mb-2">Reverse Matching</h3>
      <div className="flex items-center gap-4">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-[var(--mp-accent)]">{matchesCount}</span>
          <span className="text-sm text-[var(--mp-muted)]">
            perfil{matchesCount !== 1 ? 'es' : ''} interesado{matchesCount !== 1 ? 's' : ''}
          </span>
        </div>
        {adminUrl && (
          <a
            href={adminUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl text-sm font-medium btn-accent"
          >
            Ver en Admin →
          </a>
        )}
      </div>
      {topSearchIds.length > 0 && (
        <p className="text-xs text-[var(--mp-muted)] mt-2">
          {topSearchIds.length} búsqueda{topSearchIds.length !== 1 ? 's' : ''} con match
        </p>
      )}
    </div>
  );
}
