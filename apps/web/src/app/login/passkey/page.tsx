'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';

const API_BASE = '/api';

export default function PasskeyPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();
  const supportsWebAuthn = typeof window !== 'undefined' && browserSupportsWebAuthn();

  async function handlePasskeyLogin(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/auth/webauthn/login/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim() || undefined }),
      });
      if (!res.ok) {
        setStatus('error');
        setErrorMsg('No se pudieron obtener las opciones');
        return;
      }
      const data = await res.json();
      const options = data?.options;
      const challenge = data?.challenge;
      if (!options) {
        setStatus('error');
        setErrorMsg('Respuesta inválida del servidor');
        return;
      }
      const optionsWithChallenge = options.challenge ? options : { ...options, challenge };
      const response = await startAuthentication(optionsWithChallenge);
      const verifyRes = await fetch(`${API_BASE}/auth/webauthn/login/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ response, challenge }),
      });
      if (!verifyRes.ok) {
        setStatus('error');
        setErrorMsg('Verificación fallida');
        return;
      }
      setStatus('ok');
      router.replace('/feed');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Error al autenticar');
    }
  }

  async function handlePasskeyRegister(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim();
    if (!em) {
      setErrorMsg('Email requerido para crear passkey');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/auth/webauthn/register/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: em }),
      });
      if (!res.ok) {
        setStatus('error');
        setErrorMsg('No se pudieron obtener las opciones');
        return;
      }
      const data = await res.json();
      const options = data?.options;
      const challenge = data?.challenge;
      if (!options) {
        setStatus('error');
        setErrorMsg('Respuesta inválida del servidor (falta options)');
        return;
      }
      const optionsWithChallenge = options.challenge ? options : { ...options, challenge };
      const response = await startRegistration(optionsWithChallenge);
      const verifyRes = await fetch(`${API_BASE}/auth/webauthn/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ response, challenge, email: em }),
      });
      if (!verifyRes.ok) {
        setStatus('error');
        setErrorMsg('Verificación fallida');
        return;
      }
      setStatus('ok');
      router.replace('/feed');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Error al registrar passkey');
    }
  }

  const handleSubmit = mode === 'login' ? handlePasskeyLogin : handlePasskeyRegister;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">
          {mode === 'login' ? 'Entrar con passkey' : 'Crear passkey'}
        </h1>

        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          ← Volver al login
        </Link>

        {!supportsWebAuthn && (
          <p className="text-sm text-amber-600 text-center">
            Tu navegador no soporta passkeys. Usá magic link u OAuth.
          </p>
        )}

        {supportsWebAuthn && (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 py-2 rounded ${mode === 'login' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex-1 py-2 rounded ${mode === 'register' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                Crear
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                  Email {mode === 'register' ? '(requerido)' : '(opcional)'}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="tu@email.com"
                />
              </div>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {status === 'loading'
                  ? 'Verificando...'
                  : mode === 'login'
                    ? 'Usar passkey'
                    : 'Crear passkey'}
              </button>
            </form>
          </>
        )}

        {status === 'error' && errorMsg && (
          <p className="text-sm text-red-600 text-center">{errorMsg}</p>
        )}
      </div>
    </main>
  );
}
