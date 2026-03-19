'use client';

import { useEffect, useState, useCallback } from 'react';

type CelebrationType = 
  | 'match' 
  | 'price_drop' 
  | 'new_message' 
  | 'lead_active' 
  | 'saved' 
  | 'alert'
  | 'premium';

interface CelebrationProps {
  type: CelebrationType;
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  autoClose?: number;
}

const CELEBRATION_CONFIG: Record<CelebrationType, {
  emoji: string;
  defaultTitle: string;
  defaultSubtitle: string;
  color: string;
  bgGradient: string;
  confettiColors: string[];
}> = {
  match: {
    emoji: '🎉',
    defaultTitle: '¡Enhorabuena! ¡Tenemos match!',
    defaultSubtitle: 'Esta propiedad coincide perfectamente con lo que buscás',
    color: 'text-pink-600',
    bgGradient: 'from-pink-500 to-rose-500',
    confettiColors: ['#ec4899', '#f472b6', '#fbbf24', '#a855f7'],
  },
  price_drop: {
    emoji: '📉',
    defaultTitle: '¡Urraa! ¡Bajó de precio!',
    defaultSubtitle: 'Una propiedad que seguís acaba de bajar de precio',
    color: 'text-green-600',
    bgGradient: 'from-green-500 to-emerald-500',
    confettiColors: ['#22c55e', '#4ade80', '#fbbf24', '#06b6d4'],
  },
  new_message: {
    emoji: '💬',
    defaultTitle: '¡Te respondieron!',
    defaultSubtitle: 'Tenés un nuevo mensaje sobre tu consulta',
    color: 'text-blue-600',
    bgGradient: 'from-blue-500 to-cyan-500',
    confettiColors: ['#3b82f6', '#60a5fa', '#06b6d4', '#a855f7'],
  },
  lead_active: {
    emoji: '🚀',
    defaultTitle: '¡Consulta activada!',
    defaultSubtitle: 'Ya podés chatear y coordinar visitas',
    color: 'text-purple-600',
    bgGradient: 'from-purple-500 to-violet-500',
    confettiColors: ['#a855f7', '#c084fc', '#ec4899', '#3b82f6'],
  },
  saved: {
    emoji: '⭐',
    defaultTitle: '¡Guardado!',
    defaultSubtitle: 'Lo agregamos a tus favoritos',
    color: 'text-amber-600',
    bgGradient: 'from-amber-500 to-orange-500',
    confettiColors: ['#f59e0b', '#fbbf24', '#fb923c', '#ef4444'],
  },
  alert: {
    emoji: '🔔',
    defaultTitle: '¡Nueva alerta!',
    defaultSubtitle: 'Hay propiedades nuevas que coinciden con tu búsqueda',
    color: 'text-sky-600',
    bgGradient: 'from-sky-500 to-blue-500',
    confettiColors: ['#0ea5e9', '#38bdf8', '#3b82f6', '#8b5cf6'],
  },
  premium: {
    emoji: '👑',
    defaultTitle: '¡Bienvenido a Premium!',
    defaultSubtitle: 'Ahora tenés acceso a todas las funciones',
    color: 'text-amber-600',
    bgGradient: 'from-amber-400 to-yellow-500',
    confettiColors: ['#fbbf24', '#f59e0b', '#eab308', '#ca8a04'],
  },
};

function Confetti({ colors }: { colors: string[] }) {
  const [pieces, setPieces] = useState<Array<{
    id: number;
    x: number;
    color: string;
    delay: number;
    rotation: number;
    size: number;
  }>>([]);

  useEffect(() => {
    const newPieces = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)] ?? '#fbbf24',
      delay: Math.random() * 0.5,
      rotation: Math.random() * 360,
      size: Math.random() * 8 + 4,
    }));
    setPieces(newPieces);
  }, [colors]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute animate-confetti"
          style={{
            left: `${piece.x}%`,
            top: '-20px',
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            transform: `rotate(${piece.rotation}deg)`,
            animationDelay: `${piece.delay}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
          }}
        />
      ))}
    </div>
  );
}

export default function Celebration({
  type,
  title,
  subtitle,
  onClose,
  autoClose = 4000,
}: CelebrationProps) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const config = CELEBRATION_CONFIG[type];

  const handleClose = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, 300);
  }, [onClose]);

  useEffect(() => {
    if (autoClose > 0) {
      const timer = setTimeout(handleClose, autoClose);
      return () => clearTimeout(timer);
    }
  }, [autoClose, handleClose]);

  if (!visible) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* Confetti */}
      <Confetti colors={config.confettiColors} />

      {/* Card */}
      <div 
        className={`relative bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden transform transition-all duration-300 ${
          exiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100 animate-bounce-in'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient */}
        <div className={`h-2 bg-gradient-to-r ${config.bgGradient}`} />

        <div className="p-8 text-center">
          {/* Emoji with pulse animation */}
          <div className="relative inline-block mb-4">
            <span className="text-7xl animate-bounce-slow">{config.emoji}</span>
            <div className={`absolute inset-0 animate-ping opacity-30 rounded-full bg-gradient-to-r ${config.bgGradient}`} />
          </div>

          {/* Title */}
          <h2 className={`text-2xl font-bold mb-2 ${config.color}`}>
            {title || config.defaultTitle}
          </h2>

          {/* Subtitle */}
          <p className="text-gray-600 mb-6">
            {subtitle || config.defaultSubtitle}
          </p>

          {/* Button */}
          <button
            onClick={handleClose}
            className={`w-full py-3 px-6 rounded-xl text-white font-semibold bg-gradient-to-r ${config.bgGradient} hover:opacity-90 transition-opacity`}
          >
            ¡Genial!
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook para mostrar celebraciones
export function useCelebration() {
  const [celebration, setCelebration] = useState<{
    type: CelebrationType;
    title?: string;
    subtitle?: string;
  } | null>(null);

  const celebrate = useCallback((
    type: CelebrationType,
    options?: { title?: string; subtitle?: string }
  ) => {
    setCelebration({ type, ...options });
  }, []);

  const dismiss = useCallback(() => {
    setCelebration(null);
  }, []);

  const CelebrationComponent = celebration ? (
    <Celebration
      type={celebration.type}
      title={celebration.title}
      subtitle={celebration.subtitle}
      onClose={dismiss}
    />
  ) : null;

  return { celebrate, dismiss, CelebrationComponent };
}
