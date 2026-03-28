/**
 * Cursor opaco base64url para paginación.
 * Listing: soporta createdAt (orden por publicación) y lastSeenAt (legacy / otros sorts).
 */

const CURSOR_MAX_LENGTH = 256;

export interface CursorPayload {
  createdAt: Date;
  id: string;
}

export interface ListingCursorPayload {
  /** Orden date_desc: publicación más reciente primero */
  createdAt?: Date;
  /** Legacy (v1) y sorts por precio/superficie */
  lastSeenAt?: Date;
  id: string;
}

function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad) b64 += '='.repeat(4 - pad);
  return b64;
}

export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify({
    createdAt: payload.createdAt.toISOString(),
    id: payload.id,
  });
  return toBase64Url(Buffer.from(json, 'utf8').toString('base64'));
}

export function decodeCursor(cursor: string | undefined): CursorPayload | null {
  if (!cursor || typeof cursor !== 'string') return null;
  const trimmed = cursor.trim();
  if (trimmed === '' || trimmed.length > CURSOR_MAX_LENGTH) return null;
  try {
    const b64 = fromBase64Url(trimmed);
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const decoded = JSON.parse(json) as { createdAt?: string; id?: string };
    if (typeof decoded?.createdAt !== 'string' || typeof decoded?.id !== 'string') return null;
    if (decoded.id.length > 50) return null;
    const createdAt = new Date(decoded.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: decoded.id };
  } catch {
    return null;
  }
}

export function encodeListingCursor(payload: ListingCursorPayload): string {
  const o: Record<string, string> = { id: payload.id };
  if (payload.createdAt) o.createdAt = payload.createdAt.toISOString();
  if (payload.lastSeenAt) o.lastSeenAt = payload.lastSeenAt.toISOString();
  const json = JSON.stringify(o);
  return toBase64Url(Buffer.from(json, 'utf8').toString('base64'));
}

export function decodeListingCursor(cursor: string | undefined): ListingCursorPayload | null {
  if (!cursor || typeof cursor !== 'string') return null;
  const trimmed = cursor.trim();
  if (trimmed === '' || trimmed.length > CURSOR_MAX_LENGTH) return null;
  try {
    const b64 = fromBase64Url(trimmed);
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const decoded = JSON.parse(json) as {
      lastSeenAt?: string;
      createdAt?: string;
      id?: string;
    };
    if (typeof decoded?.id !== 'string' || decoded.id.length > 50) return null;
    let createdAt: Date | undefined;
    let lastSeenAt: Date | undefined;
    if (typeof decoded.createdAt === 'string') {
      const d = new Date(decoded.createdAt);
      if (!Number.isNaN(d.getTime())) createdAt = d;
    }
    if (typeof decoded.lastSeenAt === 'string') {
      const d = new Date(decoded.lastSeenAt);
      if (!Number.isNaN(d.getTime())) lastSeenAt = d;
    }
    if (!createdAt && !lastSeenAt) return null;
    return { id: decoded.id, createdAt, lastSeenAt };
  } catch {
    return null;
  }
}
