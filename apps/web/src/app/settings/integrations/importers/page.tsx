'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = '/api';

/** Formato esperado: { "yumblin": [{ url, format }], "icasas": [...], "zonaprop": [...], ... } */
type SourcesJson = Record<string, { url: string; format: string }[]>;

const DEFAULT_SOURCES: SourcesJson = {
  externalsite: [
    {
      url: 'https://static.kiteprop.com/kp/difusions/4b3c894a10d905c82e85b35c410d7d4099551504/externalsite-2-9e4f284e1578b24afa155c578d05821ac4c56baa.json',
      format: 'json',
    },
  ],
  yumblin: [
    {
      url: 'https://static.kiteprop.com/kp/difusions/23705a4a85ab8f1d301c73aae5359a81a8b5c1ca/yumblin.json',
      format: 'json',
    },
  ],
  icasas: [
    {
      url: 'https://www.kiteprop.com/difusions/icasas',
      format: 'json',
    },
  ],
  zonaprop: [
    {
      url: 'https://static.kiteprop.com/kp/difusions/13d87da051c790afaf09c7afd094f151d7d06290/zonaprop.xml',
      format: 'xml',
    },
  ],
};

export default function ImportersSettingsPage() {
  const [rawJson, setRawJson] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE}/integrations/importers`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          router.replace('/login');
          return null;
        }
        if (res.status === 403) {
          router.replace('/me/profile');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.sourcesJson && Object.keys(data.sourcesJson).length > 0) {
          setRawJson(JSON.stringify(data.sourcesJson, null, 2));
        } else {
          setRawJson(JSON.stringify(DEFAULT_SOURCES, null, 2));
        }
      })
      .catch(() => setRawJson(JSON.stringify(DEFAULT_SOURCES, null, 2)))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLoadDefault = () => {
    setRawJson(JSON.stringify(DEFAULT_SOURCES, null, 2));
    setMessage('Plantilla cargada. Guardá para aplicar.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let parsed: SourcesJson;
    try {
      parsed = JSON.parse(rawJson) as SourcesJson;
    } catch {
      setMessage('JSON inválido. Corregí la sintaxis.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/integrations/importers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sourcesJson: parsed }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) {
        setMessage('Error al guardar');
        return;
      }
      setMessage('Guardado correctamente. Yumblin, iCasas y otras fuentes usan estas URLs.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen p-4">
        <div className="max-w-2xl mx-auto">Cargando...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">Fuentes de importación</h1>
          <Link
            href="/me/settings"
            className="px-3 py-1.5 text-sm bg-[var(--mp-card)] border border-[var(--mp-border)] rounded-lg hover:bg-[var(--mp-bg)]"
          >
            Volver
          </Link>
        </div>

        <p className="text-sm text-[var(--mp-muted)] mb-4">
          Configuración de fuentes Kiteprop (zonaprop, yumblin, etc.). En producción se usa{' '}
          <strong>yumblin</strong>. Cada fuente tiene URL y formato (json/xml).
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              JSON de fuentes (formato Kiteprop difusiones)
            </label>
            <textarea
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg font-mono text-sm h-64 bg-[var(--mp-card)] border-[var(--mp-border)]"
              placeholder='{"yumblin":[{"url":"...","format":"json"}]}'
              spellCheck={false}
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleLoadDefault}
                className="px-3 py-1.5 text-sm bg-[var(--mp-card)] border border-[var(--mp-border)] rounded-lg hover:bg-[var(--mp-bg)]"
              >
                Cargar plantilla
              </button>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[var(--mp-accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>

        {message && (
          <p className="mt-4 text-sm" role="alert">
            {message}
          </p>
        )}

        <div className="mt-6 p-4 rounded-xl bg-[var(--mp-bg)] border border-[var(--mp-border)]">
          <p className="text-xs text-[var(--mp-muted)]">
            <strong>externalsite:</strong> Token Kiteprop (KITEPROP_EXTERNALSITE). <strong>yumblin:</strong> producción.
            También: KITEPROP_EXTERNALSITE_URL, KITEPROP_DIFUSION_YUMBLIN_URL en .env.
          </p>
        </div>
      </div>
    </main>
  );
}
