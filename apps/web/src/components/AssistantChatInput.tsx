'use client';

import type { Ref } from 'react';

interface AssistantChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  loading?: boolean;
  placeholder?: string;
  voiceSupported?: boolean;
  voiceListening?: boolean;
  onVoiceClick?: () => void;
  maxLength?: number;
  textAreaRef?: Ref<HTMLTextAreaElement>;
}

/** Barra de chat moderna para IA Assistant - estilo WhatsApp/iMessage */
export default function AssistantChatInput({
  value,
  onChange,
  onSend,
  loading = false,
  placeholder = 'Escribí o hablá tu búsqueda...',
  voiceSupported = false,
  voiceListening = false,
  onVoiceClick,
  maxLength = 500,
  textAreaRef,
}: AssistantChatInputProps) {
  return (
    <div className="flex gap-2 items-end p-3 rounded-2xl bg-[var(--mp-card)] border border-[var(--mp-border)] shadow-sm">
      <div className="flex-1 relative">
        <textarea
          ref={textAreaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={2}
          className="w-full p-3 pr-12 rounded-xl min-h-[48px] max-h-32 resize-none bg-[var(--mp-bg)] border border-[var(--mp-border)] text-[var(--mp-foreground)] placeholder:text-neutral-400/80 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-[var(--mp-accent)] focus:border-transparent outline-none text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        {voiceSupported && (
          <button
            type="button"
            onClick={onVoiceClick}
            disabled={loading || voiceListening}
            title={voiceListening ? 'Escuchando...' : 'Buscar por voz'}
            className={`absolute right-2 bottom-2 w-10 h-10 flex items-center justify-center rounded-xl transition-colors min-h-[48px] ${
              voiceListening
                ? 'bg-red-100 text-red-700 animate-pulse'
                : 'bg-[var(--mp-bg)] text-[var(--mp-muted)] hover:bg-[var(--mp-border)] hover:text-[var(--mp-foreground)]'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onSend}
        disabled={loading}
        aria-label="Enviar búsqueda"
        className="flex-shrink-0 w-12 h-12 min-h-[48px] flex items-center justify-center rounded-xl btn-accent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}
