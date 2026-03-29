'use client';

import { useState, useEffect } from 'react';

const TIPS = [
  {
    emoji: '💡',
    title: '¿Sabías que...?',
    text: 'Podés activar alertas para que te avisemos cuando baje el precio de una propiedad.',
  },
  {
    emoji: '🎯',
    title: 'Tip pro',
    text: 'Guardá varias búsquedas para comparar opciones en diferentes zonas.',
  },
  {
    emoji: '🔔',
    title: 'No te pierdas nada',
    text: 'Activá las notificaciones push para enterarte al instante de nuevas propiedades.',
  },
  {
    emoji: '⭐',
    title: 'Organizate mejor',
    text: 'Usá favoritos para las que más te gusten y "Me gusta" para verlas después.',
  },
  {
    emoji: '🗺️',
    title: 'Explorá el mapa',
    text: 'Podés ver todas las propiedades en el mapa y filtrar por zona.',
  },
  {
    emoji: '🤖',
    title: 'Usá el asistente',
    text: 'Escribí o hablá lo que buscás y el asistente arma la búsqueda por vos.',
  },
  {
    emoji: '📊',
    title: 'Comparador',
    text: 'Agregá propiedades a una lista para compararlas fácilmente.',
  },
  {
    emoji: '💬',
    title: 'Consultá sin compromiso',
    text: 'Enviá consultas a las inmobiliarias directamente desde la app.',
  },
];

const MOTIVATIONAL = [
  { emoji: '🏠', text: '¡Tu casa ideal te está esperando!' },
  { emoji: '✨', text: '¡Hoy puede ser el día!' },
  { emoji: '🔥', text: '¡Hay propiedades nuevas para vos!' },
  { emoji: '🚀', text: '¡Seguí buscando, vas muy bien!' },
  { emoji: '💪', text: '¡No te rindas, la vas a encontrar!' },
  { emoji: '🎉', text: '¡Estás a un match de tu nuevo hogar!' },
];

export function TipBanner({ onDismiss }: { onDismiss?: () => void }) {
  const [tip, setTip] = useState<(typeof TIPS)[0] | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const randomTip = TIPS[Math.floor(Math.random() * TIPS.length)];
    if (randomTip) setTip(randomTip);
  }, []);

  if (!tip || !visible) return null;

  return (
    <div className="bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-100 rounded-2xl p-4 mb-4 animate-bounce-in">
      <div className="flex items-start gap-3">
        <span className="text-2xl animate-float">{tip.emoji}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sky-800 text-sm">{tip.title}</h4>
          <p className="text-sky-700 text-sm">{tip.text}</p>
        </div>
        {onDismiss && (
          <button
            onClick={() => {
              setVisible(false);
              onDismiss();
            }}
            className="text-sky-400 hover:text-sky-600 text-lg"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export function MotivationalBanner() {
  const [message, setMessage] = useState<(typeof MOTIVATIONAL)[0] | null>(null);

  useEffect(() => {
    const randomMessage = MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)];
    if (randomMessage) setMessage(randomMessage);
  }, []);

  if (!message) return null;

  return (
    <div className="text-center py-3 px-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl">
      <span className="text-lg mr-2 animate-bounce-slow inline-block">{message.emoji}</span>
      <span className="text-amber-800 font-medium">{message.text}</span>
    </div>
  );
}

export function WelcomeMessage({
  name,
  as: Tag = 'h1',
}: {
  name?: string | null;
  as?: 'h1' | 'h2' | 'p';
}) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '¡Buenos días';
    if (hour < 19) return '¡Buenas tardes';
    return '¡Buenas noches';
  };

  const greetings = [
    `${getGreeting()}${name ? `, ${name}` : ''}! 👋`,
    `¡Hola${name ? ` ${name}` : ''}! ¿Listo para buscar? 🏠`,
    `¡Qué bueno verte${name ? `, ${name}` : ''}! ✨`,
  ];

  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    setGreeting(randomGreeting ?? '¡Hola! 👋');
  }, [name]);

  return (
    <Tag className="text-xl md:text-2xl font-bold text-[var(--mp-foreground)]">{greeting}</Tag>
  );
}

export function StreakCounter({ days }: { days: number }) {
  if (days < 2) return null;

  const getStreakEmoji = (d: number) => {
    if (d >= 30) return '🏆';
    if (d >= 14) return '🔥';
    if (d >= 7) return '⚡';
    return '✨';
  };

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-100 to-red-100 rounded-full">
      <span className="animate-bounce-slow">{getStreakEmoji(days)}</span>
      <span className="text-sm font-semibold text-orange-800">{days} días seguidos</span>
    </div>
  );
}

export function AchievementBadge({
  type,
  count,
}: {
  type: 'likes' | 'favorites' | 'searches' | 'visits';
  count: number;
}) {
  const badges = {
    likes: { emoji: '💚', label: 'Me gusta', thresholds: [10, 50, 100, 500] },
    favorites: { emoji: '⭐', label: 'Favoritos', thresholds: [5, 25, 50, 100] },
    searches: { emoji: '🔍', label: 'Búsquedas', thresholds: [3, 10, 25, 50] },
    visits: { emoji: '🏠', label: 'Visitas', thresholds: [1, 5, 10, 25] },
  };

  const badge = badges[type];
  const level = badge.thresholds.filter((t) => count >= t).length;

  if (level === 0) return null;

  const colors = [
    'bg-gray-100 text-gray-600',
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
  ];

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors[level - 1]}`}
    >
      <span>{badge.emoji}</span>
      <span>{badge.label}</span>
      <span className="ml-1">Lv.{level}</span>
    </div>
  );
}

export function ProgressRing({
  progress,
  size = 60,
  strokeWidth = 6,
  emoji,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  emoji?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-sky-500 transition-all duration-500"
        />
      </svg>
      {emoji && <span className="absolute text-xl">{emoji}</span>}
    </div>
  );
}
