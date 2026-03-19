'use client';

import { useEffect, useState, useCallback, createContext, useContext, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'celebration' | 'tip';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  emoji?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, options?: { emoji?: string; duration?: number }) => void;
  showSuccess: (message: string, emoji?: string) => void;
  showError: (message: string) => void;
  showCelebration: (message: string, emoji?: string) => void;
  showTip: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_CONFIG: Record<ToastType, { defaultEmoji: string; bgClass: string; textClass: string }> = {
  success: {
    defaultEmoji: '✅',
    bgClass: 'bg-green-50 border-green-200',
    textClass: 'text-green-800',
  },
  error: {
    defaultEmoji: '😅',
    bgClass: 'bg-red-50 border-red-200',
    textClass: 'text-red-800',
  },
  info: {
    defaultEmoji: '💡',
    bgClass: 'bg-blue-50 border-blue-200',
    textClass: 'text-blue-800',
  },
  celebration: {
    defaultEmoji: '🎉',
    bgClass: 'bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200',
    textClass: 'text-pink-800',
  },
  tip: {
    defaultEmoji: '💡',
    bgClass: 'bg-amber-50 border-amber-200',
    textClass: 'text-amber-800',
  },
};

// Mensajes divertidos aleatorios
const FUN_SUCCESS_MESSAGES = [
  '¡Listo! 🎯',
  '¡Hecho! ✨',
  '¡Perfecto! 👌',
  '¡Genial! 🚀',
  '¡Guardado! 💾',
];

const FUN_ERROR_MESSAGES = [
  'Ups, algo salió mal 😅',
  'Hmm, hubo un problema 🤔',
  'Oops! Intentemos de nuevo 🔄',
];

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [exiting, setExiting] = useState(false);
  const config = TOAST_CONFIG[toast.type];

  useEffect(() => {
    const duration = toast.duration ?? 3000;
    const exitTimer = setTimeout(() => setExiting(true), duration - 300);
    const closeTimer = setTimeout(onClose, duration);
    
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(closeTimer);
    };
  }, [toast.duration, onClose]);

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg
        transform transition-all duration-300 cursor-pointer
        ${config.bgClass}
        ${exiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
        animate-bounce-in
      `}
      onClick={() => {
        setExiting(true);
        setTimeout(onClose, 300);
      }}
    >
      <span className="text-2xl animate-bounce-slow">
        {toast.emoji ?? config.defaultEmoji}
      </span>
      <p className={`font-medium ${config.textClass}`}>{toast.message}</p>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((
    type: ToastType,
    message: string,
    options?: { emoji?: string; duration?: number }
  ) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-4), { id, type, message, ...options }]);
  }, []);

  const showSuccess = useCallback((message: string, emoji?: string) => {
    const randomSuccess = FUN_SUCCESS_MESSAGES[Math.floor(Math.random() * FUN_SUCCESS_MESSAGES.length)] ?? '¡Listo!';
    const funMessage = message || randomSuccess;
    showToast('success', funMessage, { emoji });
  }, [showToast]);

  const showError = useCallback((message: string) => {
    const randomError = FUN_ERROR_MESSAGES[Math.floor(Math.random() * FUN_ERROR_MESSAGES.length)] ?? 'Error';
    const funMessage = message || randomError;
    showToast('error', funMessage);
  }, [showToast]);

  const showCelebration = useCallback((message: string, emoji?: string) => {
    showToast('celebration', message, { emoji, duration: 4000 });
  }, [showToast]);

  const showTip = useCallback((message: string) => {
    showToast('tip', message, { duration: 5000 });
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showCelebration, showTip }}>
      {children}
      
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

// Mensajes predefinidos para diferentes eventos
export const FUN_MESSAGES = {
  match: [
    '¡Enhorabuena! ¡Tenemos match! 🎉',
    '¡Wow! Esta propiedad es perfecta para vos 🏠',
    '¡Bingo! Encontramos lo que buscás ⭐',
  ],
  priceDrop: [
    '¡Urraa! ¡Bajó de precio! 📉',
    '¡Buenas noticias! Bajó el precio 💰',
    '¡Oferta! El precio acaba de bajar 🎯',
  ],
  newListing: [
    '¡Nueva propiedad que te puede interesar! 🆕',
    '¡Mirá esto! Acaba de publicarse 👀',
    '¡Recién salida del horno! 🔥',
  ],
  saved: [
    '¡Guardado en favoritos! ⭐',
    '¡Listo! Lo tenés en tus favoritos 💾',
    '¡Perfecto! Guardado para después 📌',
  ],
  messageReceived: [
    '¡Te respondieron! 💬',
    '¡Nuevo mensaje! Alguien te escribió 📩',
    '¡Ding dong! Tenés un mensaje 🔔',
  ],
  leadActive: [
    '¡Tu consulta está activa! 🚀',
    '¡Genial! Ya podés chatear con ellos 💬',
    '¡Activado! Coordiná tu visita 📅',
  ],
  visitScheduled: [
    '¡Visita agendada! 📅',
    '¡Perfecto! Te esperan el día acordado 🏠',
    '¡Listo! Anotado en el calendario 📝',
  ],
  searchSaved: [
    '¡Búsqueda guardada! 🔍',
    '¡Genial! Te avisaremos cuando haya novedades 🔔',
    '¡Perfecto! Ahora recibirás alertas 📬',
  ],
  premium: [
    '¡Bienvenido a Premium! 👑',
    '¡Sos Premium! Disfrutá todos los beneficios ✨',
    '¡Excelente elección! Ahora tenés todo 🎉',
  ],
};

export function getRandomMessage(type: keyof typeof FUN_MESSAGES): string {
  const messages = FUN_MESSAGES[type];
  return messages[Math.floor(Math.random() * messages.length)] ?? '¡Listo!';
}
