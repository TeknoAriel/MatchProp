'use client';

import { useState, useCallback, useEffect } from 'react';

type RecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: {
    results: { [index: number]: { [index: number]: { transcript?: string } } };
  }) => void;
  onend: () => void;
  onerror: (event: { error: string }) => void;
  start: () => void;
};

/**
 * Hook para Web Speech API (SpeechRecognition).
 * Captura voz del usuario y devuelve el texto transcrito.
 * Compatible con Chrome, Edge, Safari (macOS/iOS).
 */
export function useSpeechRecognition(lang = 'es-AR') {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const win =
      typeof window !== 'undefined'
        ? (window as Window & {
            SpeechRecognition?: new () => RecognitionInstance;
            webkitSpeechRecognition?: new () => RecognitionInstance;
          })
        : null;
    const SpeechRecognition = win?.SpeechRecognition ?? win?.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const start = useCallback(() => {
    const win =
      typeof window !== 'undefined'
        ? (window as Window & {
            SpeechRecognition?: new () => RecognitionInstance;
            webkitSpeechRecognition?: new () => RecognitionInstance;
          })
        : null;
    const SpeechRecognition = win?.SpeechRecognition ?? win?.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Tu navegador no soporta búsqueda por voz.');
      return;
    }

    setError(null);
    setTranscript('');
    setIsListening(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang;

    recognition.onresult = (event: { results: Array<{ 0?: { transcript?: string } }> }) => {
      const results = event.results ?? [];
      const last = results[results.length - 1];
      const text = last?.[0]?.transcript?.trim() ?? '';
      setTranscript(text);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: { error: string }) => {
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setError('Permiso de micrófono denegado.');
      } else if (event.error === 'no-speech') {
        setError('No se detectó voz. Intentá de nuevo.');
      } else {
        setError(`Error: ${event.error}`);
      }
    };

    recognition.start();
  }, [lang]);

  const stop = useCallback(() => {
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return { isSupported, isListening, transcript, error, start, stop, reset };
}
