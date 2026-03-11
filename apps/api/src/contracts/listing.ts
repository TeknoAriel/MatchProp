/** ListingDTO completo - tipo KiteProp API. Core + details JSONB. */
export interface ListingDTOCore {
  id: string;
  source: string;
  externalId: string;
  title: string | null;
  description: string | null;
  operationType: string | null;
  propertyType: string | null;
  price: number | null;
  currency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaTotal: number | null;
  areaCovered: number | null;
  lat: number | null;
  lng: number | null;
  addressText: string | null;
  locationText: string | null;
  heroImageUrl: string | null;
  photosCount: number;
  media: { url: string; sortOrder: number }[];
}

export interface ListingDetailsExtra {
  amenities?: string[];
  services?: string[];
  orientation?: string;
  floor?: number;
  totalFloors?: number;
  aptoCredito?: boolean;
  yearBuilt?: number;
  condition?: string;
}

export type ListingDTO = ListingDTOCore & { details?: ListingDetailsExtra | null };
