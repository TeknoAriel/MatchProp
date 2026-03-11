'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = '/api';

type Config = {
  baseUrl: string;
  leadCreatePath: string;
  authHeaderName: string;
  authFormat: string;
  isEnabled: boolean;
  hasApiKey: boolean;
  hasSpec: boolean;
  payloadTemplate: string;
  lastTestOk: boolean | null;
  lastTestHttpStatus: number | null;
  lastTestAt: string | null;
};

export default function KitepropSettingsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [specFetching, setSpecFetching] = useState(false);
  const [specSaving, setSpecSaving] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestTemplateLoading, setSuggestTemplateLoading] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<object | null>(null);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    httpStatus: number;
    snippet: string;
    userMessage?: string;
  } | null>(null);
  const [form, setForm] = useState({
    baseUrl: '',
    leadCreatePath: '',
    authHeaderName: '',
    authFormat: 'ApiKey' as 'Bearer' | 'ApiKey',
    apiKey: '',
    isEnabled: true,
    payloadTemplate: '',
  });
  const [specUrl, setSpecUrl] = useState('');
  const [specPaste, setSpecPaste] = useState('');
  const [specMessage, setSpecMessage] = useState<string | null>(null);
  const [suggestMessage, setSuggestMessage] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<
    {
      id: string;
      leadId: string;
      listingTitle: string;
      status: string;
      httpStatus: number | null;
      createdAt: string;
    }[]
  >([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [retryLastFailedLoading, setRetryLastFailedLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE}/integrations/kiteprop`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          router.replace('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setConfig(data);
          setForm({
            baseUrl: data.baseUrl ?? 'https://api.kiteprop.com/v1',
            leadCreatePath: data.leadCreatePath ?? '/leads',
            authHeaderName: data.authHeaderName ?? 'X-API-Key',
            authFormat: data.authFormat ?? 'ApiKey',
            apiKey: '',
            isEnabled: data.isEnabled ?? false,
            payloadTemplate: data.payloadTemplate ?? '',
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    const raw = (form.payloadTemplate || '').trim();
    if (!raw) {
      setTemplateError(null);
      return;
    }
    try {
      JSON.parse(raw);
      setTemplateError(null);
    } catch {
      setTemplateError(
        'El template no es un JSON válido. Corregí la sintaxis para guardar o probar.'
      );
    }
  }, [form.payloadTemplate]);

  useEffect(() => {
    if (!config) return;
    setAttemptsLoading(true);
    fetch(`${API_BASE}/integrations/kiteprop/attempts?limit=10`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { attempts: [] }))
      .then((data) => setAttempts(data.attempts ?? []))
      .finally(() => setAttemptsLoading(false));
  }, [config, testResult]);

  async function handleRetryLastFailed() {
    setRetryLastFailedLoading(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/integrations/kiteprop/retry-last-failed`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      setTestResult({
        ok: data.ok ?? false,
        httpStatus: data.httpStatus ?? res.status,
        snippet: data.snippet ?? (res.ok ? 'OK' : 'Error'),
        userMessage: data.userMessage,
      });
      if (res.ok) {
        const list = await fetch(`${API_BASE}/integrations/kiteprop/attempts?limit=10`, {
          credentials: 'include',
        }).then((r) => r.json().catch(() => ({})));
        setAttempts(list.attempts ?? []);
      }
    } finally {
      setRetryLastFailedLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/integrations/kiteprop`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          baseUrl: form.baseUrl,
          leadCreatePath: form.leadCreatePath,
          authHeaderName: form.authHeaderName,
          authFormat: form.authFormat,
          apiKey: form.apiKey || undefined,
          isEnabled: form.isEnabled,
          payloadTemplate: form.payloadTemplate || undefined,
        }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setTestResult({ ok: false, httpStatus: res.status, snippet: err.message ?? 'Error' });
        return;
      }
      setForm((f) => ({ ...f, apiKey: '' }));
      setConfig((c) =>
        c
          ? {
              ...c,
              ...form,
              hasApiKey: !!form.apiKey || c.hasApiKey,
              payloadTemplate: form.payloadTemplate,
            }
          : null
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleFetchSpec() {
    if (!specUrl.trim()) return;
    setSpecFetching(true);
    setSpecMessage(null);
    try {
      const res = await fetch(`${API_BASE}/integrations/kiteprop/spec/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: specUrl.trim() }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSpecMessage('Spec guardada OK');
        setConfig((c) => (c ? { ...c, hasSpec: true } : null));
      } else {
        setSpecMessage(data.message ?? 'Error al descargar');
      }
    } catch (e) {
      setSpecMessage(e instanceof Error ? e.message : 'Error');
    } finally {
      setSpecFetching(false);
    }
  }

  async function handleSaveSpec() {
    if (!specPaste.trim()) return;
    setSpecSaving(true);
    setSpecMessage(null);
    try {
      const res = await fetch(`${API_BASE}/integrations/kiteprop/spec/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: specPaste.trim() }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSpecMessage('Spec guardada OK');
        setConfig((c) => (c ? { ...c, hasSpec: true } : null));
      } else {
        setSpecMessage(data.message ?? 'Error al guardar');
      }
    } catch (e) {
      setSpecMessage(e instanceof Error ? e.message : 'Error');
    } finally {
      setSpecSaving(false);
    }
  }

  async function handleSuggest() {
    setSuggestLoading(true);
    setSuggestMessage(null);
    try {
      const res = await fetch(`${API_BASE}/integrations/kiteprop/spec/suggest`, {
        credentials: 'include',
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.baseUrl || data.leadCreatePath || data.authHeaderName) {
        setForm((f) => ({
          ...f,
          baseUrl: data.baseUrl ?? f.baseUrl,
          leadCreatePath: data.leadCreatePath ?? f.leadCreatePath,
          authHeaderName: data.authHeaderName ?? f.authHeaderName,
          authFormat: data.authFormat ?? f.authFormat,
        }));
      } else {
        setSuggestMessage(
          'No se detectó endpoint de leads. Pegá el JSON correcto o completá Base URL + path manual.'
        );
      }
    } finally {
      setSuggestLoading(false);
    }
  }

  async function handleSuggestTemplate() {
    setSuggestTemplateLoading(true);
    setSuggestMessage(null);
    try {
      const res = await fetch(`${API_BASE}/integrations/kiteprop/spec/suggest-template`, {
        credentials: 'include',
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      const data = await res.json().catch(() => ({}));
      const template = data.template ?? '{}';
      setForm((f) => ({ ...f, payloadTemplate: template }));
      const trimmed = template.trim();
      if (trimmed === '{}' || trimmed === '') {
        setSuggestMessage(
          'No se detectó endpoint de leads. Pegá el JSON correcto o completá Base URL + path manual.'
        );
      }
    } finally {
      setSuggestTemplateLoading(false);
    }
  }

  async function handlePreviewRender() {
    try {
      const res = await fetch(`${API_BASE}/integrations/kiteprop/render-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ template: form.payloadTemplate || undefined }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      const data = await res.json().catch(() => ({}));
      setPreviewPayload(data.payload ?? {});
    } catch {
      setPreviewPayload(null);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/integrations/kiteprop/test`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      setTestResult({
        ok: data.ok ?? false,
        httpStatus: data.httpStatus ?? res.status,
        snippet: data.snippet ?? (res.ok ? 'OK' : 'Error'),
        userMessage: data.userMessage,
      });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen p-4">
        <div className="max-w-lg mx-auto">Cargando...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">Integración Kiteprop</h1>
          <Link
            href="/leads"
            className="px-3 py-1 text-sm bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Mis consultas
          </Link>
        </div>

        {/* OpenAPI Spec */}
        <section className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h2 className="font-semibold mb-2">OpenAPI Spec</h2>
          <div className="space-y-2 mb-2">
            <label className="block text-sm font-medium">OpenAPI URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={specUrl}
                onChange={(e) => setSpecUrl(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg"
                placeholder="https://api.ejemplo.com/openapi.json"
              />
              <button
                type="button"
                onClick={handleFetchSpec}
                disabled={specFetching}
                className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50 text-sm"
              >
                {specFetching ? '...' : 'Descargar y guardar'}
              </button>
            </div>
          </div>
          <div className="space-y-2 mb-2">
            <label className="block text-sm font-medium">Pegar OpenAPI JSON/YAML</label>
            <p className="text-xs text-gray-500 mb-1">Si falla YAML, usá JSON.</p>
            <textarea
              value={specPaste}
              onChange={(e) => setSpecPaste(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg font-mono text-sm h-24"
              placeholder='{"openapi":"3.0",...}'
            />
            <button
              type="button"
              onClick={handleSaveSpec}
              disabled={specSaving}
              className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50 text-sm"
            >
              {specSaving ? '...' : 'Guardar spec'}
            </button>
          </div>
          {config?.hasSpec && <p className="text-sm text-green-600">Spec guardada OK</p>}
          {specMessage && <p className="text-sm">{specMessage}</p>}
        </section>

        {/* Estado Kiteprop */}
        <section className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h2 className="font-semibold mb-2">Estado Kiteprop</h2>
          <p className="text-sm">
            {config?.isEnabled ? (
              <span className="text-green-600">Habilitado</span>
            ) : (
              <span className="text-gray-500">Deshabilitado</span>
            )}
          </p>
          {config?.lastTestAt && (
            <p className="text-sm mt-1">
              Último test:{' '}
              {config.lastTestOk ? (
                <span className="text-green-600">OK</span>
              ) : (
                <span className="text-red-600">FAIL</span>
              )}{' '}
              {config.lastTestHttpStatus != null && `HTTP ${config.lastTestHttpStatus}`} ·{' '}
              {new Date(config.lastTestAt).toLocaleString()}
            </p>
          )}
        </section>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={handleSuggest}
              disabled={suggestLoading || !config?.hasSpec}
              className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 disabled:opacity-50 text-sm"
            >
              {suggestLoading ? '...' : 'Autocompletar desde spec'}
            </button>
            {suggestMessage && <p className="text-sm text-amber-700 mt-1">{suggestMessage}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Base URL</label>
            <input
              type="url"
              value={form.baseUrl}
              onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="https://api.kiteprop.com/v1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Lead create path</label>
            <input
              type="text"
              value={form.leadCreatePath}
              onChange={(e) => setForm((f) => ({ ...f, leadCreatePath: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="/leads"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Auth header</label>
            <input
              type="text"
              value={form.authHeaderName}
              onChange={(e) => setForm((f) => ({ ...f, authHeaderName: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="X-API-Key"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Auth format</label>
            <select
              value={form.authFormat}
              onChange={(e) =>
                setForm((f) => ({ ...f, authFormat: e.target.value as 'Bearer' | 'ApiKey' }))
              }
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="ApiKey">ApiKey (header value)</option>
              <option value="Bearer">Bearer (Authorization)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">API Key</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder={
                config?.hasApiKey ? '•••••••• (dejar vacío para mantener)' : 'Pegá tu API key'
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Payload template (JSON)</label>
            <textarea
              value={form.payloadTemplate}
              onChange={(e) => setForm((f) => ({ ...f, payloadTemplate: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg font-mono text-sm h-28"
              placeholder={
                '{"email":"{{buyer.email}}","message":"{{lead.message}}","listing_id":"{{listing.externalId}}"}'
              }
            />
            <p className="text-xs text-gray-500 mt-1">
              Variables: buyer.email, buyer.id, lead.message, lead.id, listing.externalId,
              listing.title, listing.price, listing.currency
            </p>
            {templateError && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {templateError}
              </p>
            )}
            <div className="mt-2 flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleSuggestTemplate}
                disabled={suggestTemplateLoading || !config?.hasSpec}
                className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 disabled:opacity-50 text-sm"
              >
                {suggestTemplateLoading ? '...' : 'Generar template sugerido'}
              </button>
              <button
                type="button"
                onClick={handlePreviewRender}
                disabled={!!templateError}
                className="px-3 py-1.5 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50 text-sm"
              >
                Probar render
              </button>
            </div>
            {previewPayload !== null && (
              <pre className="mt-2 p-2 bg-white border rounded text-xs overflow-auto max-h-40">
                {JSON.stringify(previewPayload, null, 2)}
              </pre>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={form.isEnabled}
              onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))}
            />
            <label htmlFor="enabled">Habilitado</label>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || !!templateError}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !!templateError}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50"
            >
              {testing ? 'Enviando...' : 'Enviar lead de prueba'}
            </button>
          </div>
        </form>

        <section className="mt-6 p-4 border rounded-lg bg-gray-50">
          <h2 className="font-semibold mb-2">Últimos envíos</h2>
          <p className="text-sm text-gray-500 mb-2">
            Últimos 10 intentos de envío a Kiteprop. Enlace a{' '}
            <Link href="/leads" className="text-blue-600 hover:underline">
              Mis consultas
            </Link>
            .
          </p>
          <button
            type="button"
            onClick={handleRetryLastFailed}
            disabled={retryLastFailedLoading}
            className="mb-3 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 disabled:opacity-50 text-sm"
          >
            {retryLastFailedLoading ? 'Reintentando...' : 'Reintentar último lead fallido'}
          </button>
          {attemptsLoading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : attempts.length === 0 ? (
            <p className="text-sm text-gray-500">Aún no hay envíos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-1 pr-2">Lead</th>
                    <th className="py-1 pr-2">Listing</th>
                    <th className="py-1 pr-2">Estado</th>
                    <th className="py-1 pr-2">HTTP</th>
                    <th className="py-1">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id} className="border-b border-gray-200">
                      <td className="py-1 pr-2">
                        <Link
                          href="/leads"
                          className="text-blue-600 hover:underline truncate block max-w-[8rem]"
                          title={a.leadId}
                        >
                          {a.leadId.slice(-8)}
                        </Link>
                      </td>
                      <td className="py-1 pr-2 truncate max-w-[10rem]" title={a.listingTitle}>
                        {a.listingTitle || '—'}
                      </td>
                      <td className="py-1 pr-2">
                        <span className={a.status === 'OK' ? 'text-green-600' : 'text-red-600'}>
                          {a.status}
                        </span>
                      </td>
                      <td className="py-1 pr-2">{a.httpStatus ?? '—'}</td>
                      <td className="py-1 text-gray-500">
                        {new Date(a.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {testResult && (
          <div
            className={`mt-4 p-3 rounded-lg ${
              testResult.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            <p className="font-medium">{testResult.ok ? 'OK' : 'FAIL'}</p>
            {testResult.httpStatus > 0 && <p>HTTP {testResult.httpStatus}</p>}
            <p className="text-xs mt-1 text-gray-700">
              Request: {form.baseUrl.replace(/\/$/, '')}
              {form.leadCreatePath.startsWith('/')
                ? form.leadCreatePath
                : '/' + form.leadCreatePath}{' '}
              · Header: {form.authHeaderName || 'X-API-Key'} ({form.authFormat})
            </p>
            <p className="text-sm mt-1 break-all">{testResult.userMessage ?? testResult.snippet}</p>
          </div>
        )}
      </div>
    </main>
  );
}
