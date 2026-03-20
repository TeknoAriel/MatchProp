import { formatDate } from '@matchprop/shared';
import AdminHomeClient from './AdminHomeClient';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-50">
      <h1 className="text-3xl font-bold text-slate-900">MatchProp Admin</h1>
      <p className="mt-4 text-slate-600">Panel de administración</p>
      <p className="mt-2 text-sm text-slate-500">Hoy: {formatDate(new Date())}</p>
      <AdminHomeClient />
      <nav className="mt-6 flex gap-4 text-sm flex-wrap justify-center">
        <Link href="/users" className="text-blue-600 hover:underline">
          Usuarios
        </Link>
        <Link href="/stats" className="text-blue-600 hover:underline">
          Estadísticas
        </Link>
        <Link href="/crm-push" className="text-blue-600 hover:underline">
          CRM Push Outbox
        </Link>
        <Link href="/match-events" className="text-blue-600 hover:underline">
          Match Events
        </Link>
        <Link href="/visits" className="text-blue-600 hover:underline">
          Visitas
        </Link>
      </nav>
    </main>
  );
}
