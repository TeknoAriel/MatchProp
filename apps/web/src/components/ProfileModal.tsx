'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const API_BASE = '/api';

export interface ProfileData {
  firstName?: string | null;
  lastName?: string | null;
  dni?: string | null;
  matricula?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  twitter?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  website?: string | null;
  address?: string | null;
  avatarUrl?: string | null;
}

export interface OrgData {
  name?: string | null;
  commercialName?: string | null;
  address?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  twitter?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  website?: string | null;
}

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const INPUT_CLASS =
  'w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';

export default function ProfileModal({ open, onClose, onSaved }: ProfileModalProps) {
  const [profile, setProfile] = useState<ProfileData>({});
  const [org, setOrg] = useState<OrgData | null>(null);
  const [role, setRole] = useState<string>('BUYER');
  const [email, setEmail] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [orgSaving, setOrgSaving] = useState(false);
  const [tiers, setTiers] = useState<Record<string, number>>({});

  const initialRoleRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      Promise.all([
        fetch(`${API_BASE}/me/profile`, { credentials: 'include' }).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch(`${API_BASE}/me/premium-tier`, { credentials: 'include' }).then((r) =>
          r.ok ? r.json() : null
        ),
      ])
        .then(([data, tierData]) => {
          if (data) {
            const r = data.role ?? 'BUYER';
            setEmail(data.email ?? '');
            setRole(r);
            initialRoleRef.current = r;
            setHasPassword(data.hasPassword ?? false);
            setProfile(data.profile ?? {});
            setOrg(data.organization ?? null);
          }
          if (tierData?.tiers) setTiers(tierData.tiers);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [open]);

  function handleOrgSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setOrgSaving(true);
    fetch(`${API_BASE}/me/organization`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(org),
    })
      .then((res) => {
        if (res.ok) {
          onSaved?.();
        }
        return res.ok;
      })
      .finally(() => setOrgSaving(false));
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    setPasswordSaving(true);
    fetch(`${API_BASE}/me/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          setPasswordError(data.message);
        } else {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setShowPasswordForm(false);
        }
      })
      .catch(() => setPasswordError('Error al cambiar contraseña'))
      .finally(() => setPasswordSaving(false));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const roleChanged = initialRoleRef.current != null && role !== initialRoleRef.current;
    const allowedRoles = ['BUYER', 'AGENT', 'REALTOR', 'INMOBILIARIA'];

    fetch(`${API_BASE}/me/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(profile),
    })
      .then((res) => res.ok)
      .then((ok) => {
        if (!ok) return Promise.resolve(false);
        if (roleChanged && allowedRoles.includes(role)) {
          return fetch(`${API_BASE}/me/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ role }),
          }).then((r) => r.ok);
        }
        return Promise.resolve(true);
      })
      .then((ok) => {
        if (ok) {
          onSaved?.();
          onClose();
        }
        setSaving(false);
      })
      .catch(() => setSaving(false));
  }

  if (!open) return null;

  const isInmobiliaria = role === 'INMOBILIARIA';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-900">Mi perfil</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {loading ? (
            <div className="h-48 flex items-center justify-center text-slate-500">Cargando...</div>
          ) : (
            <div className="space-y-6">
              {/* Foto de perfil */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border-2 border-slate-300">
                  {profile.avatarUrl ? (
                    <img 
                      src={profile.avatarUrl} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl text-slate-400">👤</span>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Foto de perfil (URL)
                  </label>
                  <input
                    type="url"
                    value={profile.avatarUrl ?? ''}
                    onChange={(e) => setProfile((p) => ({ ...p, avatarUrl: e.target.value }))}
                    className={INPUT_CLASS}
                    placeholder="https://ejemplo.com/mi-foto.jpg"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Pegá la URL de una imagen. Podés usar servicios como Imgur o Gravatar.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  className={`${INPUT_CLASS} bg-slate-50`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tipo de usuario
                </label>
                {role === 'ADMIN' ? (
                  <p className="text-sm text-slate-600 py-1.5">Administrador</p>
                ) : (
                  <>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className={`${INPUT_CLASS} py-2`}
                    >
                      <option value="BUYER">Usuario buscando / vendiendo</option>
                      <option value="REALTOR">Corredor inmobiliario</option>
                      <option value="AGENT">Agente</option>
                      <option value="INMOBILIARIA">Inmobiliaria</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      {tiers[role] != null && (
                        <span className="font-medium text-slate-700">
                          Plan{' '}
                          {role === 'BUYER'
                            ? 'Usuario'
                            : role === 'AGENT'
                              ? 'Agente'
                              : role === 'REALTOR'
                                ? 'Corredor'
                                : 'Inmobiliaria'}
                          : {tiers[role]} USD/mes.{' '}
                        </span>
                      )}
                      Ver{' '}
                      <Link
                        href="/me/premium"
                        className="text-blue-600 hover:underline"
                        onClick={onClose}
                      >
                        planes y características
                      </Link>
                    </p>
                  </>
                )}
                {isInmobiliaria && (
                  <Link
                    href="/me/organization"
                    className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                    onClick={onClose}
                  >
                    Gestionar inmobiliaria e invitar colaboradores →
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={profile.firstName ?? ''}
                    onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
                    className={INPUT_CLASS}
                    placeholder="Juan"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Apellido</label>
                  <input
                    type="text"
                    value={profile.lastName ?? ''}
                    onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
                    className={INPUT_CLASS}
                    placeholder="Pérez"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">DNI</label>
                  <input
                    type="text"
                    value={profile.dni ?? ''}
                    onChange={(e) => setProfile((p) => ({ ...p, dni: e.target.value }))}
                    className={INPUT_CLASS}
                    placeholder="12345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Matrícula</label>
                  <input
                    type="text"
                    value={profile.matricula ?? ''}
                    onChange={(e) => setProfile((p) => ({ ...p, matricula: e.target.value }))}
                    className={INPUT_CLASS}
                    placeholder="Matrícula profesional"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Domicilio</label>
                <input
                  type="text"
                  value={profile.address ?? ''}
                  onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="Calle, número, ciudad"
                />
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="font-semibold text-slate-800 mb-3">Contacto</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-0.5">Teléfono</label>
                    <input
                      type="text"
                      value={profile.phone ?? ''}
                      onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-0.5">WhatsApp</label>
                    <input
                      type="text"
                      value={profile.whatsapp ?? ''}
                      onChange={(e) => setProfile((p) => ({ ...p, whatsapp: e.target.value }))}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-0.5">Telegram</label>
                    <input
                      type="text"
                      value={profile.telegram ?? ''}
                      onChange={(e) => setProfile((p) => ({ ...p, telegram: e.target.value }))}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-0.5">Página web</label>
                    <input
                      type="url"
                      value={profile.website ?? ''}
                      onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))}
                      className={INPUT_CLASS}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-0.5">Twitter/X</label>
                    <input
                      type="text"
                      value={profile.twitter ?? ''}
                      onChange={(e) => setProfile((p) => ({ ...p, twitter: e.target.value }))}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-0.5">Instagram</label>
                    <input
                      type="text"
                      value={profile.instagram ?? ''}
                      onChange={(e) => setProfile((p) => ({ ...p, instagram: e.target.value }))}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-0.5">Facebook</label>
                    <input
                      type="text"
                      value={profile.facebook ?? ''}
                      onChange={(e) => setProfile((p) => ({ ...p, facebook: e.target.value }))}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              </div>

              {hasPassword && (
                <div className="border-t border-slate-200 pt-4">
                  <h3 className="font-semibold text-slate-800 mb-3">Contraseña</h3>
                  {!showPasswordForm ? (
                    <button
                      type="button"
                      onClick={() => setShowPasswordForm(true)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Cambiar contraseña
                    </button>
                  ) : (
                    <form onSubmit={handlePasswordSubmit} className="space-y-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">
                          Contraseña actual
                        </label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className={INPUT_CLASS}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">
                          Nueva contraseña
                        </label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className={INPUT_CLASS}
                          minLength={8}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">
                          Confirmar nueva contraseña
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={INPUT_CLASS}
                          minLength={8}
                          required
                        />
                      </div>
                      {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={passwordSaving}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          {passwordSaving ? 'Guardando...' : 'Cambiar contraseña'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPasswordForm(false);
                            setPasswordError('');
                          }}
                          className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {isInmobiliaria && org && (
                <div className="border-t border-slate-200 pt-4">
                  <h3 className="font-semibold text-slate-800 mb-3">Datos de la inmobiliaria</h3>
                  <form onSubmit={handleOrgSubmit} className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">
                        Nombre de la inmobiliaria
                      </label>
                      <input
                        type="text"
                        value={org.name ?? ''}
                        onChange={(e) => setOrg((o) => (o ? { ...o, name: e.target.value } : null))}
                        className={INPUT_CLASS}
                        placeholder="Razón social"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">
                        Nombre comercial
                      </label>
                      <input
                        type="text"
                        value={org.commercialName ?? ''}
                        onChange={(e) =>
                          setOrg((o) => (o ? { ...o, commercialName: e.target.value } : null))
                        }
                        className={INPUT_CLASS}
                        placeholder="Nombre para mostrar"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Domicilio</label>
                      <input
                        type="text"
                        value={org.address ?? ''}
                        onChange={(e) =>
                          setOrg((o) => (o ? { ...o, address: e.target.value } : null))
                        }
                        className={INPUT_CLASS}
                        placeholder="Calle, número, ciudad"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">Teléfono</label>
                        <input
                          type="text"
                          value={org.phone ?? ''}
                          onChange={(e) =>
                            setOrg((o) => (o ? { ...o, phone: e.target.value } : null))
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">WhatsApp</label>
                        <input
                          type="text"
                          value={org.whatsapp ?? ''}
                          onChange={(e) =>
                            setOrg((o) => (o ? { ...o, whatsapp: e.target.value } : null))
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">Telegram</label>
                        <input
                          type="text"
                          value={org.telegram ?? ''}
                          onChange={(e) =>
                            setOrg((o) => (o ? { ...o, telegram: e.target.value } : null))
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">Página web</label>
                        <input
                          type="url"
                          value={org.website ?? ''}
                          onChange={(e) =>
                            setOrg((o) => (o ? { ...o, website: e.target.value } : null))
                          }
                          className={INPUT_CLASS}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">Twitter/X</label>
                        <input
                          type="text"
                          value={org.twitter ?? ''}
                          onChange={(e) =>
                            setOrg((o) => (o ? { ...o, twitter: e.target.value } : null))
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">Instagram</label>
                        <input
                          type="text"
                          value={org.instagram ?? ''}
                          onChange={(e) =>
                            setOrg((o) => (o ? { ...o, instagram: e.target.value } : null))
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">Facebook</label>
                        <input
                          type="text"
                          value={org.facebook ?? ''}
                          onChange={(e) =>
                            setOrg((o) => (o ? { ...o, facebook: e.target.value } : null))
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={orgSaving}
                      className="px-4 py-2 bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                    >
                      {orgSaving ? 'Guardando...' : 'Guardar datos de la inmobiliaria'}
                    </button>
                  </form>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
