'use client';

import { useState } from 'react';

const DEFAULT_MESSAGE = 'Me interesa esta propiedad, quiero recibir más información.';

export interface InquiryModalProps {
  open: boolean;
  onClose: () => void;
  listingId: string;
  source: 'FEED' | 'LIST' | 'ASSISTANT' | 'DETAIL';
  onSent: () => void;
  sending?: boolean;
}

export default function InquiryModal({
  open,
  onClose,
  listingId,
  source,
  onSent,
  sending: sendingProp = false,
}: InquiryModalProps) {
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [sending, setSending] = useState(false);
  const sendingAny = sending || sendingProp;

  if (!open) return null;

  async function handleSubmit() {
    setSending(true);
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        listingId,
        source,
        message: message.trim() || DEFAULT_MESSAGE,
      }),
    });
    if (res.ok) {
      setMessage(DEFAULT_MESSAGE);
      onSent();
      onClose();
    }
    setSending(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-slate-900 mb-2">Enviar consulta</h3>
        <p className="text-sm text-slate-900 mb-3">
          Escribí el mensaje que querés enviar. Podés editarlo antes de enviar.
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={DEFAULT_MESSAGE}
          rows={4}
          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-700 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={sendingAny}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {sendingAny ? 'Enviando...' : 'Enviar'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-slate-800 rounded-xl hover:bg-slate-100 font-medium"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
