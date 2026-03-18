'use client';

import { useState, ReactNode } from 'react';

interface FunButtonProps {
  onClick?: () => void;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'premium';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  haptic?: boolean;
}

const VARIANT_CLASSES = {
  primary: 'bg-sky-500 hover:bg-sky-600 text-white',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
  success: 'bg-green-500 hover:bg-green-600 text-white',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
  premium: 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white',
};

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2.5 text-base rounded-xl',
  lg: 'px-6 py-3.5 text-lg rounded-xl',
};

export function FunButton({
  onClick,
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  icon,
  haptic = true,
}: FunButtonProps) {
  const [pressed, setPressed] = useState(false);

  const handleClick = () => {
    if (disabled || loading) return;
    
    if (haptic && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
    
    onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      className={`
        inline-flex items-center justify-center gap-2 font-medium
        transition-all duration-150 ease-out
        disabled:opacity-50 disabled:cursor-not-allowed
        ${VARIANT_CLASSES[variant]}
        ${SIZE_CLASSES[size]}
        ${pressed ? 'scale-95 shadow-inner' : 'scale-100 shadow-md hover:shadow-lg'}
        ${className}
      `}
    >
      {loading ? (
        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : icon ? (
        <span className="animate-bounce-slow">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

// Botón de Like con corazón animado
export function LikeButton({
  liked,
  onClick,
  size = 'md',
}: {
  liked: boolean;
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [animating, setAnimating] = useState(false);

  const handleClick = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(liked ? 10 : [10, 50, 10]);
    }
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);
    onClick();
  };

  const sizeClasses = {
    sm: 'w-8 h-8 text-lg',
    md: 'w-10 h-10 text-xl',
    lg: 'w-12 h-12 text-2xl',
  };

  return (
    <button
      onClick={handleClick}
      className={`
        ${sizeClasses[size]}
        rounded-full flex items-center justify-center
        transition-all duration-200
        ${liked 
          ? 'bg-red-100 text-red-500 hover:bg-red-200' 
          : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
        }
        ${animating ? 'scale-125' : 'scale-100'}
      `}
    >
      <span className={animating ? 'animate-bounce-in' : ''}>
        {liked ? '❤️' : '🤍'}
      </span>
    </button>
  );
}

// Botón de Favorito con estrella animada
export function FavoriteButton({
  favorited,
  onClick,
  size = 'md',
}: {
  favorited: boolean;
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [animating, setAnimating] = useState(false);

  const handleClick = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(favorited ? 10 : [10, 50, 10]);
    }
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);
    onClick();
  };

  const sizeClasses = {
    sm: 'w-8 h-8 text-lg',
    md: 'w-10 h-10 text-xl',
    lg: 'w-12 h-12 text-2xl',
  };

  return (
    <button
      onClick={handleClick}
      className={`
        ${sizeClasses[size]}
        rounded-full flex items-center justify-center
        transition-all duration-200
        ${favorited 
          ? 'bg-amber-100 text-amber-500 hover:bg-amber-200' 
          : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
        }
        ${animating ? 'scale-125 rotate-12' : 'scale-100 rotate-0'}
      `}
    >
      <span className={animating ? 'animate-bounce-in' : ''}>
        {favorited ? '⭐' : '☆'}
      </span>
    </button>
  );
}

// Botón de Match animado (estilo Tinder)
export function MatchSwipeButton({
  type,
  onClick,
  disabled,
}: {
  type: 'like' | 'nope' | 'super';
  onClick: () => void;
  disabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);

  const config = {
    like: {
      emoji: '💚',
      bg: 'bg-green-500 hover:bg-green-600',
      label: 'Me gusta',
    },
    nope: {
      emoji: '👎',
      bg: 'bg-red-500 hover:bg-red-600',
      label: 'Pasar',
    },
    super: {
      emoji: '⭐',
      bg: 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600',
      label: 'Super Like',
    },
  };

  const { emoji, bg, label } = config[type];

  return (
    <button
      onClick={() => {
        if ('vibrate' in navigator) {
          navigator.vibrate(type === 'super' ? [50, 30, 50] : 30);
        }
        onClick();
      }}
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      className={`
        w-16 h-16 rounded-full flex items-center justify-center
        text-white font-bold shadow-lg
        transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        ${bg}
        ${pressed ? 'scale-90' : 'scale-100 hover:scale-110'}
      `}
      title={label}
    >
      <span className={`text-2xl ${pressed ? '' : 'animate-float'}`}>{emoji}</span>
    </button>
  );
}

// Badge de notificación animado
export function NotificationBadge({
  count,
  animate = true,
}: {
  count: number;
  animate?: boolean;
}) {
  if (count === 0) return null;

  return (
    <span
      className={`
        absolute -top-1 -right-1 min-w-5 h-5 px-1.5
        flex items-center justify-center
        bg-red-500 text-white text-xs font-bold rounded-full
        ${animate ? 'animate-bounce-in' : ''}
      `}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

// Skeleton loader divertido
export function FunSkeleton({
  type = 'card',
}: {
  type?: 'card' | 'text' | 'avatar' | 'button';
}) {
  const skeletons = {
    card: (
      <div className="bg-white rounded-2xl p-4 space-y-3 animate-pulse">
        <div className="h-48 bg-gray-200 rounded-xl flex items-center justify-center">
          <span className="text-4xl opacity-30 animate-bounce-slow">🏠</span>
        </div>
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
    ),
    text: <div className="h-4 bg-gray-200 rounded animate-pulse" />,
    avatar: (
      <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse flex items-center justify-center">
        <span className="text-xl opacity-30">👤</span>
      </div>
    ),
    button: <div className="h-10 w-24 bg-gray-200 rounded-xl animate-pulse" />,
  };

  return skeletons[type];
}

// Indicador de carga divertido
export function FunLoader({
  message,
  emoji = '🏠',
}: {
  message?: string;
  emoji?: string;
}) {
  const loadingMessages = [
    'Buscando tu casa ideal...',
    'Explorando opciones...',
    'Casi listo...',
    'Un momento...',
  ];

  const displayMessage = message ?? loadingMessages[Math.floor(Math.random() * loadingMessages.length)];

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <span className="text-5xl animate-bounce-slow mb-4">{emoji}</span>
      <p className="text-gray-600 animate-pulse">{displayMessage}</p>
    </div>
  );
}

// Empty state divertido
export function FunEmptyState({
  emoji = '🔍',
  title,
  description,
  action,
}: {
  emoji?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <span className="text-6xl mb-4 animate-float">{emoji}</span>
      <h3 className="text-xl font-semibold text-gray-800 mb-2">{title}</h3>
      {description && <p className="text-gray-600 mb-6 max-w-sm">{description}</p>}
      {action}
    </div>
  );
}
