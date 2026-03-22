'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

const API_BASE = '/api';
const GRACE_PERIOD = process.env.NEXT_PUBLIC_PREMIUM_GRACE_PERIOD === '1';

type Message = {
  id: string;
  senderType: string;
  body: string;
  blockedReason: string | null;
  createdAt: string;
};

type Lead = { id: string; status: string };

export default function LeadChatPage() {
  const params = useParams();
  const leadId = params.id as string;
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/leads/${leadId}/messages`, { credentials: 'include' }),
      fetch(`${API_BASE}/me/leads`, { credentials: 'include' }),
    ]).then(async ([msgRes, leadsRes]) => {
      if (msgRes.status === 401 || leadsRes.status === 401) {
        router.replace('/login');
        return;
      }
      if (msgRes.ok) setMessages(await msgRes.json());
      if (leadsRes.ok) {
        const leads = await leadsRes.json();
        const l = leads.find((x: Lead) => x.id === leadId);
        setLead(l ?? null);
      }
      setLoading(false);
    });
  }, [leadId, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || sending || !leadId) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/leads/${leadId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: input.trim() }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        const msg =
          res.status === 403
            ? 'Activá el lead para chatear'
            : res.status === 404
              ? 'Lead no encontrado'
              : d?.message || `Error ${res.status}`;
        setError(msg);
        return;
      }
      setInput('');
      const msgRes = await fetch(`${API_BASE}/leads/${leadId}/messages`, {
        credentials: 'include',
      });
      if (msgRes.ok) {
        const data = await msgRes.json();
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--mp-bg)]">
        <div className="h-12 w-12 border-4 border-[var(--mp-accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--mp-muted)] mt-3">Cargando chat...</p>
      </main>
    );
  }

  if (!lead || lead.status !== 'ACTIVE') {
    return (
      <main className="min-h-screen p-4 bg-[var(--mp-bg)]">
        <div className="max-w-lg mx-auto">
          <div className="rounded-2xl bg-[var(--mp-card)] border border-[var(--mp-border)] p-6">
            <p className="text-amber-700 font-medium">
              {!lead ? 'Lead no encontrado' : 'Activá el lead para chatear'}
            </p>
            <p className="text-sm text-[var(--mp-muted)] mt-2">
              {lead && lead.status !== 'ACTIVE'
                ? 'En Consultas, activá la consulta para desbloquear el chat.'
                : 'Verificá que la consulta exista.'}
            </p>
            <Link
              href="/leads"
              className="inline-block mt-4 px-4 py-2 bg-[var(--mp-accent)] text-white rounded-xl font-medium hover:opacity-90"
            >
              Volver a consultas
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isUser = (senderType: string) =>
    String(senderType).toUpperCase() === 'USER' || String(senderType).toUpperCase() === 'BUYER';

  return (
    <main className="min-h-screen flex flex-col bg-[var(--mp-bg)]">
      <header className="sticky top-0 z-10 bg-[var(--mp-card)] border-b border-[var(--mp-border)] px-4 py-3">
        <nav className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-[var(--mp-muted)]">
            <Link href="/leads" className="hover:text-[var(--mp-foreground)]">
              Consultas
            </Link>
            <span>›</span>
            <span className="text-[var(--mp-foreground)] font-medium">Chat</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/leads/${leadId}/visits`}
              className="px-3 py-1.5 text-sm font-medium rounded-xl border border-[var(--mp-border)] text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)]"
            >
              Agendar visita
            </Link>
            <Link
              href="/leads"
              className="px-3 py-1.5 text-sm font-medium rounded-xl bg-[var(--mp-bg)] text-[var(--mp-foreground)] hover:bg-[var(--mp-card)]"
            >
              Salir
            </Link>
          </div>
        </nav>
      </header>

      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4">
        {GRACE_PERIOD && (
          <p className="text-xs text-slate-700 bg-[var(--mp-premium)]/15 border border-[var(--mp-premium)]/40 rounded-xl px-3 py-2 mb-3">
            Modo prueba: chat premium habilitado.{' '}
            <Link href="/me/premium" className="underline font-medium">
              Ver planes
            </Link>
          </p>
        )}
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
          No compartas email, teléfono ni URLs (serán bloqueados).
        </p>

        <div className="flex-1 overflow-y-auto rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-card)] p-4 min-h-[240px] max-h-[50vh] space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center min-h-[180px]">
              <span className="text-4xl mb-3">💬</span>
              <p className="text-[var(--mp-foreground)] font-medium">Sin mensajes todavía</p>
              <p className="text-sm text-[var(--mp-muted)] mt-1 max-w-[240px]">
                Escribí abajo para coordinar con la inmobiliaria. No compartas email, teléfono ni URLs.
              </p>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={m.id || `msg-${idx}`}
                className={`flex ${isUser(m.senderType) ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    isUser(m.senderType)
                      ? 'bg-[var(--mp-accent)] text-white rounded-br-md'
                      : 'bg-[var(--mp-bg)] text-[var(--mp-foreground)] border border-[var(--mp-border)] rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                  {m.blockedReason && (
                    <p className="text-xs mt-1 opacity-90">(bloqueado: {m.blockedReason})</p>
                  )}
                  <p
                    className={`text-xs mt-1 ${
                      isUser(m.senderType) ? 'text-white/80' : 'text-[var(--mp-muted)]'
                    }`}
                  >
                    {new Date(m.createdAt).toLocaleString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && <p className="text-red-600 text-sm mt-2 px-1">{error}</p>}

        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Escribí tu mensaje..."
            className="flex-1 px-4 py-3 rounded-xl border border-[var(--mp-border)] bg-[var(--mp-card)] text-[var(--mp-foreground)] placeholder:text-[var(--mp-muted)] focus:ring-2 focus:ring-[var(--mp-accent)] focus:border-[var(--mp-accent)] outline-none"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="px-5 py-3 bg-[var(--mp-accent)] text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? '...' : 'Enviar'}
          </button>
        </div>
      </div>
    </main>
  );
}
