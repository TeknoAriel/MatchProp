import type { SourceConnector } from '../types.js';
import type { ListingSource } from '@prisma/client';

/**
 * Kiteprop API v1 connector — skeleton "activable".
 *
 * La documentación en https://www.kiteprop.com/docs/api/v1 no carga correctamente
 * (solo "Loading..."). No se pudo obtener:
 * - Base URL real
 * - Método de autenticación (header vs query param)
 * - Endpoint para listar propiedades
 * - Paginación
 *
 * Sprint 2: implementar cuando la documentación esté disponible.
 * Env vars: KITEPROP_API_BASE_URL, KITEPROP_API_KEY
 */
export function createKitepropApiV1Connector(): SourceConnector | null {
  const baseUrl = process.env.KITEPROP_API_BASE_URL;
  const apiKey = process.env.KITEPROP_API_KEY;

  if (!baseUrl || !apiKey) {
    return null;
  }

  return {
    source: 'KITEPROP_API' as ListingSource,
    fetchBatch: async () => {
      // Pendiente: doc Kiteprop API v1 no disponible. Usar KITEPROP_EXTERNALSITE.
      throw new Error(
        'Kiteprop API v1 not configured: doc unavailable. Use KITEPROP_EXTERNALSITE.'
      );
    },
    normalize: (raw) => {
      const id = String(raw.id ?? '');
      return {
        source: 'KITEPROP_API' as ListingSource,
        externalId: id,
        publisherRef: null,
        status: 'ACTIVE' as const,
        title: null,
        description: null,
        operationType: null,
        propertyType: null,
        currency: null,
        price: null,
        bedrooms: null,
        bathrooms: null,
        areaTotal: null,
        areaCovered: null,
        lat: null,
        lng: null,
        addressText: null,
        locationText: null,
        updatedAtSource: null,
        mediaUrls: [],
      };
    },
  };
}
