'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = '/api';

type Config = {
  isEnabled: boolean;
  hasApiKey: boolean;
  fromEmail: string | null;
};

export default function SendGridSettingsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    apiKey: '',
    fromEmail: 'noreply@matchprop.com',
    isEnabled: false,
  });
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE}/integrations/sendgrid`, { credentials: 'include' })
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
        if (data) {
          setConfig(data);
          setForm({
            apiKey: '',
            fromEmail: data.fromEmail ?? 'noreply@matchprop.com',
            isEnabled: data.isEnabled ?? false,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/integrations/sendgrid`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          apiKey: form.apiKey || undefined,
          fromEmail: form.fromEmail.trim() || 'noreply@matchprop.com',
          isEnabled: form.isEnabled,
        }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (res.status === 403) {
        router.replace('/me/profile');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(err.message ?? 'Error al guardar');
        return;
      }
      setConfig((c) =>
        c
          ? {
              ...c,
              isEnabled: form.isEnabled,
              hasApiKey: !!form.apiKey || c.hasApiKey,
              fromEmail: form.fromEmail.trim() || 'noreply@matchprop.com',
            }
          : null
      );
      setForm((f) => ({ ...f, apiKey: '' }));
      setMessage('Guardado correctamente.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen p-4 md:p-6">
        <div className="max-w-lg mx-auto">
          <div className="h-8 bg-slate-200 rounded animate-pulse w-1/3 mb-6" />
          <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="max-w-lg mx-auto">
        <Link
          href="/me/settings"
          className="text-sm font-medium text-blue-600 hover:underline mb-6 inline-block"
        >
          ← Configuraciones
        </Link>

        <h1 className="text-2xl font-bold text-[var(--mp-foreground)] mb-2">
          SendGrid — Magic Link
        </h1>
        <p className="text-sm text-[var(--mp-muted)] mb-6">
          Configurá la API key y el email remitente para enviar links de login por correo. Cuando
          esté habilitado, el Magic Link usará SendGrid en lugar del modo consola.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--mp-foreground)] mb-2">
              API Key
            </label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              placeholder={
                config?.hasApiKey ? '•••••••• (dejar vacío para no cambiar)' : 'SG.xxx...'
              }
              className="w-full px-4 py-3 border border-[var(--mp-border)] rounded-xl bg-[var(--mp-card)] text-[var(--mp-foreground)]"
            />
            <p className="mt-1 text-xs text-[var(--mp-muted)]">
              {config?.hasApiKey ? 'Ya hay una API key guardada.' : 'Obtené la key en SendGrid.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--mp-foreground)] mb-2">
              Email remitente
            </label>
            <input
              type="email"
              value={form.fromEmail}
              onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))}
              placeholder="noreply@matchprop.com"
              className="w-full px-4 py-3 border border-[var(--mp-border)] rounded-xl bg-[var(--mp-card)] text-[var(--mp-foreground)]"
            />
            <p className="mt-1 text-xs text-[var(--mp-muted)]">
              Debe estar verificado en SendGrid.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))}
              className="rounded border-[var(--mp-border)]"
            />
            <span className="text-sm font-medium text-[var(--mp-foreground)]">
              Habilitar SendGrid para Magic Link
            </span>
          </label>

          {message && (
            <div
              className={`p-3 rounded-xl text-sm ${
                message.startsWith('Guardado')
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 px-4 rounded-xl bg-[var(--mp-accent)] text-white font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </form>
      </div>
    </main>
  );
}
