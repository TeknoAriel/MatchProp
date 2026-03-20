'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

type RecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (event: { error: string }) => void;
  onspeechend: () => void;
  onsoundend: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEvent = {
  results: SpeechRecognitionResultList;
  resultIndex: number;
};

type SpeechRecognitionResultList = {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
};

type SpeechRecognitionAlternative = {
  transcript: string;
  confidence: number;
};

const SILENCE_TIMEOUT_MS = 2500;
const MAX_LISTEN_TIME_MS = 30000;

/**
 * Hook para Web Speech API (SpeechRecognition).
 * Modo continuo: escucha todo lo que dice el usuario.
 * Corta después de una pausa larga (2.5s de silencio) o tiempo máximo (30s).
 */
export function useSpeechRecognition(lang = 'es-AR') {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef('');

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

  const clearTimeouts = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    clearTimeouts();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, [clearTimeouts]);

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

    stopRecognition();
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    finalTranscriptRef.current = '';
    setIsListening(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    const resetSilenceTimeout = () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      silenceTimeoutRef.current = setTimeout(() => {
        if (finalTranscriptRef.current.trim()) {
          setTranscript(finalTranscriptRef.current.trim());
        }
        stopRecognition();
      }, SILENCE_TIMEOUT_MS);
    };

    maxTimeoutRef.current = setTimeout(() => {
      if (finalTranscriptRef.current.trim()) {
        setTranscript(finalTranscriptRef.current.trim());
      }
      stopRecognition();
    }, MAX_LISTEN_TIME_MS);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) {
          final += text + ' ';
        } else {
          interim += text;
        }
      }

      if (final) {
        finalTranscriptRef.current += final;
        setTranscript(finalTranscriptRef.current.trim());
      }

      setInterimTranscript(interim);
      resetSilenceTimeout();
    };

    recognition.onend = () => {
      if (isListening && recognitionRef.current) {
        try {
          recognition.start();
        } catch {
          stopRecognition();
        }
      }
    };

    recognition.onerror = (event: { error: string }) => {
      if (event.error === 'not-allowed') {
        setError('Permiso de micrófono denegado.');
        stopRecognition();
      } else if (event.error === 'no-speech') {
        // En modo continuo ignoramos este error, seguimos escuchando
      } else if (event.error === 'aborted') {
        // Usuario canceló, no mostrar error
      } else {
        setError(`Error: ${event.error}`);
        stopRecognition();
      }
    };

    recognition.onspeechend = () => {
      resetSilenceTimeout();
    };

    try {
      recognition.start();
      resetSilenceTimeout();
    } catch (_e) {
      setError('No se pudo iniciar el reconocimiento de voz.');
      setIsListening(false);
    }
  }, [lang, stopRecognition, isListening]);

  const stop = useCallback(() => {
    if (finalTranscriptRef.current.trim()) {
      setTranscript(finalTranscriptRef.current.trim());
    }
    stopRecognition();
  }, [stopRecognition]);

  const reset = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    finalTranscriptRef.current = '';
  }, []);

  useEffect(() => {
    return () => {
      clearTimeouts();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [clearTimeouts]);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    start,
    stop,
    reset,
  };
}
