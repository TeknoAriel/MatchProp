'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = '/api';

export default function AssistantSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    provider: '',
    username: '',
    password: '',
    apiKey: '',
    token: '',
    model: '',
    conversationalModel: '',
    baseUrl: '',
    isEnabled: false,
  });
  const [hasApiKey, setHasApiKey] = useState(false);
  const [hasUsername, setHasUsername] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE}/integrations/assistant`, { credentials: 'include' })
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
          setForm({
            provider: data.provider ?? '',
            username: data.username ?? '',
            password: '',
            apiKey: '',
            token: '',
            model: data.model ?? '',
            conversationalModel: data.conversationalModel ?? '',
            baseUrl: data.baseUrl ?? '',
            isEnabled: data.isEnabled ?? false,
          });
          setHasApiKey(!!data.hasApiKey);
          setHasUsername(!!data.hasUsername);
          setHasPassword(!!data.hasPassword);
          setHasToken(!!data.hasToken);
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
      const res = await fetch(`${API_BASE}/integrations/assistant`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: form.provider || undefined,
          username: form.username || undefined,
          password: form.password || undefined,
          apiKey: form.apiKey || undefined,
          token: form.token || undefined,
          model: form.model || undefined,
          conversationalModel: form.conversationalModel || undefined,
          baseUrl: form.baseUrl || undefined,
          isEnabled: form.isEnabled,
        }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(err.message ?? 'Error al guardar');
        return;
      }
      setForm((f) => ({ ...f, apiKey: '', password: '', token: '' }));
      setHasApiKey(hasApiKey || !!form.apiKey);
      setHasPassword(hasPassword || !!form.password);
      setHasToken(hasToken || !!form.token);
      setMessage('Guardado. El asistente conversacional usará esta configuración.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="p-4">
        <div className="max-w-2xl mx-auto">Cargando...</div>
      </main>
    );
  }

  return (
    <main className="p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-[var(--mp-foreground)]">Asistente IA y voz</h1>
          <Link
            href="/me/settings"
            className="px-3 py-1.5 text-sm bg-[var(--mp-card)] border border-[var(--mp-border)] rounded-lg hover:bg-[var(--mp-bg)]"
          >
            ← Volver
          </Link>
        </div>

        <p className="text-sm text-[var(--mp-muted)] mb-4">
          Misma configuración para el asistente por texto y por voz. Usuario, contraseña, API key y
          token según el proveedor (OpenAI, Anthropic, Azure, custom). Búsqueda y conversacional.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Provider</label>
            <select
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg bg-[var(--mp-card)] border-[var(--mp-border)]"
            >
              <option value="">— Seleccionar —</option>
              <option value="openai">OpenAI (GPT)</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="azure">Azure OpenAI</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Usuario</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg bg-[var(--mp-card)] border-[var(--mp-border)]"
              placeholder={hasUsername ? 'Guardado' : 'Usuario (si aplica)'}
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Contraseña</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg bg-[var(--mp-card)] border-[var(--mp-border)]"
              placeholder={
                hasPassword ? '•••••••• (dejar vacío para mantener)' : 'Contraseña (si aplica)'
              }
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">API Key</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg bg-[var(--mp-card)] border-[var(--mp-border)]"
              placeholder={
                hasApiKey ? '•••••••• (dejar vacío para mantener)' : 'sk-... o sk-ant-...'
              }
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Token</label>
            <input
              type="password"
              value={form.token}
              onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg bg-[var(--mp-card)] border-[var(--mp-border)]"
              placeholder={hasToken ? '•••••••• (dejar vacío para mantener)' : 'Token alternativo'}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Modelo (búsqueda)</label>
            <input
              type="text"
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg bg-[var(--mp-card)] border-[var(--mp-border)]"
              placeholder="gpt-4o-mini, gpt-4, claude-3-haiku..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Modelo conversacional</label>
            <input
              type="text"
              value={form.conversationalModel}
              onChange={(e) => setForm((f) => ({ ...f, conversationalModel: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg bg-[var(--mp-card)] border-[var(--mp-border)]"
              placeholder="gpt-4o, claude-3-sonnet..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Base URL (opcional)</label>
            <input
              type="url"
              value={form.baseUrl}
              onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg bg-[var(--mp-card)] border-[var(--mp-border)]"
              placeholder="https://api.openai.com/v1"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={form.isEnabled}
              onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))}
              className="rounded border-[var(--mp-border)]"
            />
            <label htmlFor="enabled">Habilitado</label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-[var(--mp-accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-sm text-emerald-600" role="alert">
            {message}
          </p>
        )}

        <div className="mt-6 p-4 rounded-xl bg-[var(--mp-bg)] border border-[var(--mp-border)]">
          <p className="text-xs text-[var(--mp-muted)]">
            Esta configuración se usa para el <strong>Asistente IA</strong> (texto) y el{' '}
            <strong>Asistente de voz</strong> (Buscar con micrófono). Usá API Key para
            OpenAI/Anthropic. Token para otros headers. Usuario y contraseña para Basic Auth
            (custom).
          </p>
        </div>
      </div>
    </main>
  );
}
