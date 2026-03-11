'use client';

import { useState } from 'react';

export interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  url: string;
  title?: string;
  /** Nombre y apellido del usuario que comparte */
  contactName?: string;
  /** Nombre de la inmobiliaria si tiene org vinculada */
  contactOrg?: string;
  /** WhatsApp del usuario */
  contactWhatsapp?: string;
  /** Email del usuario */
  contactEmail?: string;
  /** Teléfono (legacy, preferir contactWhatsapp) */
  contactPhone?: string;
}

const shareText = (
  url: string,
  title?: string,
  contactName?: string,
  contactOrg?: string,
  contactWhatsapp?: string,
  contactEmail?: string,
  contactPhone?: string
) => {
  let text = title ? `${title}\n${url}` : url;
  const contactParts: string[] = [];
  if (contactName) contactParts.push(contactName);
  if (contactOrg) contactParts.push(contactOrg);
  if (contactWhatsapp) contactParts.push(`WSP: ${contactWhatsapp}`);
  if (contactEmail) contactParts.push(contactEmail);
  if (contactPhone && !contactWhatsapp) contactParts.push(contactPhone);
  if (contactParts.length > 0) {
    text += `\n\nContacto: ${contactParts.join(' | ')}`;
  }
  return text;
};

function fullUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  if (url.startsWith('http')) return url;
  return window.location.origin + (url.startsWith('/') ? url : '/' + url);
}

export default function ShareModal({
  open,
  onClose,
  url,
  title,
  contactName,
  contactOrg,
  contactWhatsapp,
  contactEmail,
  contactPhone,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const absoluteUrl = fullUrl(url);
  const text = shareText(
    absoluteUrl,
    title,
    contactName,
    contactOrg,
    contactWhatsapp,
    contactEmail,
    contactPhone
  );
  const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(absoluteUrl)}&text=${encodeURIComponent(title || '')}`;
  const mailto = `mailto:?subject=${encodeURIComponent(title || 'Propiedad')}&body=${encodeURIComponent(text)}`;

  function handleCopy() {
    navigator.clipboard.writeText(absoluteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-slate-900 mb-4">Compartir</h3>
        <p className="text-sm text-slate-600 mb-4">
          Elegí cómo compartir (mensajería, no publicar):
        </p>
        <div className="flex flex-col gap-2">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full py-3 px-4 bg-[#25D366]/10 text-[#25D366] rounded-xl font-medium hover:bg-[#25D366]/20 transition-colors"
          >
            <span className="text-2xl">WhatsApp</span>
          </a>
          <a
            href={tgUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full py-3 px-4 bg-[#0088cc]/10 text-[#0088cc] rounded-xl font-medium hover:bg-[#0088cc]/20 transition-colors"
          >
            <span className="text-2xl">Telegram</span>
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-3 w-full py-3 px-4 bg-slate-100 text-slate-800 rounded-xl font-medium hover:bg-slate-200 transition-colors"
          >
            {copied ? '✓ Copiado' : '📋 Copiar enlace'}
          </button>
          <a
            href={mailto}
            className="flex items-center gap-3 w-full py-3 px-4 bg-slate-100 text-slate-800 rounded-xl font-medium hover:bg-slate-200 transition-colors"
          >
            ✉️ Enviar por email
          </a>
        </div>
        <p className="text-xs text-slate-700 font-medium mt-3">
          Para Instagram o otras redes: copiá el enlace y pegalo en el mensaje directo.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full py-2 text-slate-700 text-sm hover:text-slate-900 font-medium"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
