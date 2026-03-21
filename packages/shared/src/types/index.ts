export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
}

/** Provider de identidad (OAuth, magic link, passkey) */
export type AuthIdentityProvider = 'magic_link' | 'google' | 'apple' | 'facebook' | 'passkey';

/** Identidad vinculada a un usuario */
export interface AuthIdentity {
  provider: AuthIdentityProvider;
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  createdAt: string;
  lastUsedAt?: string | null;
}

/** Membresía en organización */
export interface OrgMembership {
  orgId: string;
  orgName: string;
  role: 'org_admin' | 'agent' | 'owner';
}

/** Respuesta GET /auth/me */
export interface AuthMeResponse {
  id: string;
  email: string;
  role: 'ADMIN' | 'AGENT' | 'BUYER';
  orgMemberships: OrgMembership[];
}

/** Sesión activa (para UI) */
export interface AuthSession {
  user: Pick<AuthMeResponse, 'id' | 'email' | 'role'>;
  orgMemberships: OrgMembership[];
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

/** Card liviana del feed (sin description/media completo) */
export interface FeedCard {
  id: string;
  title: string;
  price: number;
  currency: string;
  lat: number | null;
  lng: number | null;
  mainImage: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaM2: number | null;
  operation: string;
  propertyType: string;
  locationText: string | null;
}

/** Respuesta GET /feed: total nullable si includeTotal=0 */
export interface FeedResponse {
  items: FeedCard[];
  total: number | null;
  limit: number;
  nextCursor: string | null;
}

// --- Sprint 1: ListingCard + FeedResponseV1 + DTOs ---

/** Media item para carrusel */
export interface ListingCardMedia {
  url: string;
  sortOrder: number;
}

/** Card liviana para feed Tinder (Listing canonical) */
export interface ListingCard {
  id: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaTotal: number | null;
  locationText: string | null;
  heroImageUrl: string | null;
  /** Media para carrusel de fotos */
  media?: ListingCardMedia[];
  publisherRef: string | null;
  source: string;
  operationType?: string | null;
}

/** Respuesta GET /feed (Listing-based) */
export interface FeedResponseV1 {
  items: ListingCard[];
  nextCursor: string | null;
  total: number | null;
}

export interface CreateSwipeRequest {
  listingId: string;
  decision: 'LIKE' | 'NOPE';
}

export interface CreateSavedRequest {
  listingId: string;
  listType: 'FAVORITE' | 'LATER';
}

export interface CreateLeadRequest {
  listingId: string;
  channel: 'WHATSAPP' | 'FORM' | 'TOUR_REQUEST';
  message?: string;
}

// --- Sprint 2: SearchFilters + SavedSearch + Assistant ---

/** Filtros de búsqueda normalizados (30+ PRO) */
export interface SearchFilters {
  operationType?: 'SALE' | 'RENT';
  propertyType?: string[];
  priceMin?: number;
  priceMax?: number;
  bedroomsMin?: number;
  bedroomsMax?: number;
  bathroomsMin?: number;
  bathroomsMax?: number;
  areaMin?: number;
  areaMax?: number;
  areaCoveredMin?: number;
  locationText?: string;
  addressText?: string;
  titleContains?: string;
  descriptionContains?: string;
  currency?: string;
  sortBy?: 'date_desc' | 'price_asc' | 'price_desc' | 'area_desc';
  source?: string;
  aptoCredito?: boolean;
  amenities?: string[];
  photosCountMin?: number;
  listingAgeDays?: number;
  keywords?: string[];
}

/** Búsqueda guardada */
export interface SavedSearchDTO {
  id: string;
  name: string;
  queryText: string | null;
  filters: SearchFilters;
  createdAt: string;
  updatedAt: string;
}

/** Respuesta del asistente de búsqueda */
export interface AssistantSearchResponse {
  filters: SearchFilters;
  explanation: string;
  warnings?: string[];
}
