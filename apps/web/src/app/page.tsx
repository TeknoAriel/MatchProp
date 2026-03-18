'use client';

import Link from 'next/link';

export default function Home() {
  // Sin auto-redirect: siempre mostramos la home. Si ya estás logueado, usá "Ver feed" o el menú.
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-b from-slate-50 to-white">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">MatchProp</h1>
        <p className="text-slate-600 mb-8">
          Encontrá tu próximo hogar deslizando. Match de propiedades.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-md transition-all"
          >
            Ingresar
          </Link>
          <Link
            href="/feed"
            className="px-6 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
          >
            Ver feed
          </Link>
        </div>
        <p className="text-sm text-slate-400 mt-6">
          Deslizá, guardá tus favoritos y contactá inmobiliarias.
        </p>
      </div>
    </main>
  );
}
