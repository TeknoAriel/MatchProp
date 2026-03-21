import { readFileSync } from 'fs';
import { join } from 'path';
import type { SourceConnector } from '../types.js';
import type { ListingSource } from '@prisma/client';
import type { ListingDetailsFromIngest } from '../types.js';

const FIXTURE_LEGACY = join(process.cwd(), 'src/services/ingest/fixtures/zonaprop-sample.xml');
const FIXTURE_OPENNAVENT = join(
  process.cwd(),
  'src/services/ingest/fixtures/zonaprop-opennavent-sample.xml'
);
const LOCATION_MAX = 200;

/** URL por defecto: feed estático KiteProp (sobrescribir con KITEPROP_DIFUSION_ZONAPROP_URL). */
const DEFAULT_URL =
  process.env.KITEPROP_DIFUSION_ZONAPROP_URL ||
  'https://static.kiteprop.com/kp/difusions/13d87da051c790afaf09c7afd094f151d7d06290/zonaprop.xml';

const PROPERTY_TYPE_MAP: Record<string, string> = {
  apartment: 'APARTMENT',
  house: 'HOUSE',
  office: 'OFFICE',
  land: 'LAND',
  other: 'OTHER',
};

/** Texto de `tipo` (OpenNavent) → enum Prisma */
const TIPO_TEXTO_MAP: Record<string, string> = {
  casa: 'HOUSE',
  departamento: 'APARTMENT',
  depto: 'APARTMENT',
  terreno: 'LAND',
  lote: 'LAND',
  local: 'OFFICE',
  oficina: 'OFFICE',
  cochera: 'OTHER',
  galpon: 'OFFICE',
  campo: 'LAND',
  ph: 'APARTMENT',
};

/** `CATEGORIA|CAMPO` con idValor 0/1 → etiqueta normalizada para búsqueda */
const BOOL_CARACTERISTICA_TO_AMENITY: Record<string, string> = {
  'GENERALES|PILETA': 'pileta',
  'GENERALES|PARRILLA': 'parrilla',
  'GENERALES|GIMNASIO': 'gimnasio',
  'GENERALES|HIDROMASAJE': 'hidromasaje',
  'GENERALES|SOLARIUM': 'solarium',
  'GENERALES|USO_COMERCIAL': 'uso comercial',
  'GENERALES|APTO_PROFESIONAL': 'apto profesional',
  'GENERALES|PERMITE_MASCOTAS': 'mascotas',
  'GENERALES|ACCESO_PARA_PERSONAS_CON_MOVILIDAD_REDUCIDA': 'accesibilidad',
  'AMBIENTES|JARDIN': 'jardín',
  'AMBIENTES|PATIO': 'patio',
  'AMBIENTES|TERRAZA': 'terraza',
  'AMBIENTES|BALCON': 'balcón',
  'AMBIENTES|LAVADERO': 'lavadero',
  'AMBIENTES|VESTIDOR': 'vestidor',
  'AMBIENTES|DORMITORIO_EN_SUITE': 'dormitorio en suite',
  'AMBIENTES|COCINA': 'cocina',
  'AMBIENTES|COMEDOR': 'comedor',
  'AMBIENTES|LIVING': 'living',
  'AMBIENTES|LIVING_COMEDOR': 'living comedor',
  'AMBIENTES|COMEDOR_DIARIO': 'comedor de diario',
  'OTROS|AIRE_ACONDICIONADO': 'aire acondicionado',
  'OTROS|CALEFACCION': 'calefacción',
  'OTROS|CALDERA': 'caldera',
  'OTROS|ALARMA': 'alarma',
  'OTROS|COCINA_EQUIPADA': 'cocina equipada',
  'OTROS|QUINCHO': 'quincho',
  'OTROS|SAUNA': 'sauna',
  'OTROS|VIGILANCIA': 'vigilancia',
  'OTROS|CANCHA_DE_DEPORTES': 'cancha deportes',
  'SERVICIOS|ASCENSOR': 'ascensor',
  'SERVICIOS|INTERNET/WIFI': 'internet wifi',
  'SERVICIOS|ENCARGADO': 'encargado',
  'SERVICIOS|SERVICIO_DE_LIMPIEZA': 'servicio limpieza',
};

function trunc(s: string | null | undefined): string | null {
  if (!s || typeof s !== 'string') return null;
  return s.trim().slice(0, LOCATION_MAX) || null;
}

function parseNum(v: unknown): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/** Contenido de un tag con CDATA o texto plano. */
export function getXmlText(block: string, tag: string): string | null {
  const esc = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    '<' + esc + '\\b[^>]*>(?:\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*|([\\s\\S]*?))</' + esc + '>',
    'i'
  );
  const m = block.match(re);
  if (!m) return null;
  const v = (m[1] ?? m[2] ?? '').trim();
  return v || null;
}

function getTagAttr(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp('<' + tag + '[^>]*\\s' + attr + '=["\']([^"\']*)["\']', 'i');
  const m = xml.match(re);
  return m && m[1] !== undefined ? m[1].trim() || null : null;
}

function mapTipoTextoToPropertyType(tipo: string | null): string {
  if (!tipo) return 'APARTMENT';
  const k = tipo.trim().toLowerCase();
  return TIPO_TEXTO_MAP[k] ?? PROPERTY_TYPE_MAP[k] ?? 'OTHER';
}

function parseLegacyListingsXml(buffer: string): Record<string, unknown>[] {
  const listings: Record<string, unknown>[] = [];
  const listingBlocks = buffer.match(/<listing[^>]*>[\s\S]*?<\/listing>/gi) || [];
  for (const block of listingBlocks) {
    const id = getTagAttr(block, 'listing', 'id') || getXmlText(block, 'id');
    if (!id) continue;
    const images: { url: string; order: number }[] = [];
    const imageRegex = /<image\s+url="([^"]+)"[^>]*\/?>/gi;
    let imgMatch;
    let order = 0;
    while ((imgMatch = imageRegex.exec(block)) !== null) {
      images.push({ url: imgMatch[1] ?? '', order });
      order += 1;
    }
    listings.push({
      _parser: 'legacy',
      id,
      title: getXmlText(block, 'title'),
      description: getXmlText(block, 'description'),
      operation_type: (getXmlText(block, 'operation_type') || 'sale').toLowerCase(),
      property_type: (getXmlText(block, 'property_type') || 'apartment').toLowerCase(),
      price: getXmlText(block, 'price'),
      currency: (getXmlText(block, 'currency') || 'USD').toUpperCase(),
      bedrooms: getXmlText(block, 'bedrooms'),
      bathrooms: getXmlText(block, 'bathrooms'),
      area_total: getXmlText(block, 'area_total'),
      latitude: getXmlText(block, 'latitude'),
      longitude: getXmlText(block, 'longitude'),
      address: getXmlText(block, 'address'),
      location_text: getXmlText(block, 'location_text') || getXmlText(block, 'address'),
      publisher_ref: getXmlText(block, 'publisher_ref'),
      status: (getXmlText(block, 'status') || 'active').toLowerCase(),
      updated_at: getXmlText(block, 'updated_at'),
      images,
    });
  }
  return listings;
}

function pickPrecioOpenNavent(block: string): {
  monto: number | null;
  moneda: string;
  operacion: string;
} | null {
  const pbs = block.match(/<precio>[\s\S]*?<\/precio>/gi) || [];
  let first: { monto: number | null; moneda: string; operacion: string } | null = null;
  let venta: typeof first = null;
  for (const pb of pbs) {
    const monto = parseNum(getXmlText(pb, 'monto'));
    const moneda = (getXmlText(pb, 'moneda') || 'USD').toUpperCase();
    const operacion = (getXmlText(pb, 'operacion') || '').toUpperCase();
    const row = { monto, moneda, operacion };
    if (!first) first = row;
    if (operacion === 'VENTA') venta = row;
  }
  return venta || first;
}

function parseCaracteristicasOpenNavent(block: string): {
  bedrooms: number | null;
  bathrooms: number | null;
  areaTotal: number | null;
  areaCovered: number | null;
  details: ListingDetailsFromIngest;
} {
  const chars = block.match(/<caracteristica>[\s\S]*?<\/caracteristica>/gi) || [];
  const principales: Record<string, number | string> = {};
  const ambientes: Record<string, boolean> = {};
  const catalog: Record<string, string> = {};
  const amenities = new Set<string>();
  const caracteristicasRaw: { nombre: string; idValor?: string; valor?: string }[] = [];
  let bedrooms: number | null = null;
  let bathrooms: number | null = null;
  let areaTotal: number | null = null;
  let areaCovered: number | null = null;

  const cocheraCount = (): void => {
    amenities.add('cochera');
  };

  for (const c of chars) {
    const nombre = getXmlText(c, 'nombre');
    if (!nombre) continue;
    const idValor = getXmlText(c, 'idValor');
    const valor = getXmlText(c, 'valor');
    caracteristicasRaw.push({ nombre, idValor: idValor ?? undefined, valor: valor ?? undefined });

    if (nombre === 'PRINCIPALES|DORMITORIO' && valor != null) {
      const n = parseInt(valor, 10);
      if (!Number.isNaN(n)) bedrooms = n;
      principales.dormitorio = n;
      continue;
    }
    if (nombre === 'PRINCIPALES|BANO' && valor != null) {
      const n = parseInt(valor, 10);
      if (!Number.isNaN(n)) bathrooms = n;
      principales.bano = n;
      continue;
    }
    if (nombre === 'PRINCIPALES|AMBIENTE' && valor != null) {
      principales.ambiente = parseInt(valor, 10);
      continue;
    }
    if (nombre === 'PRINCIPALES|COCHERA' && valor != null) {
      const n = parseInt(valor, 10);
      principales.cochera = n;
      if (!Number.isNaN(n) && n > 0) cocheraCount();
      continue;
    }
    if (nombre === 'PRINCIPALES|ANTIGUEDAD' && valor != null) {
      principales.antiguedad = valor;
      continue;
    }
    if (nombre === 'PRINCIPALES|TOILETTE' && valor != null) {
      principales.toilette = valor;
      continue;
    }
    if (nombre === 'MEDIDAS|SUPERFICIE_TOTAL' && valor != null) {
      const n = parseNum(valor);
      if (n != null) areaTotal = n;
      continue;
    }
    if (nombre === 'MEDIDAS|SUPERFICIE_CUBIERTA' && valor != null) {
      const n = parseNum(valor);
      if (n != null) areaCovered = n;
      continue;
    }

    if (nombre === 'GENERALES|COBERTURA_COCHERA' && idValor != null && idValor !== '0') {
      cocheraCount();
      catalog.coberturaCocheraId = idValor;
      continue;
    }
    if (nombre === 'GENERALES|LUMINOSO' && idValor != null && idValor !== '0') {
      catalog.luminosidadId = idValor;
      continue;
    }
    if (nombre === 'GENERALES|ORIENTACION' && idValor != null && idValor !== '0') {
      catalog.orientacionId = idValor;
      continue;
    }
    if (nombre === 'GENERALES|CANTIDAD_DE_PLANTAS' && idValor != null && idValor !== '0') {
      catalog.cantidadPlantasId = idValor;
      continue;
    }

    const [cat, field] = nombre.split('|');
    if (cat === 'AMBIENTES' && field) {
      if (idValor === '1') ambientes[field] = true;
      if (idValor === '0') ambientes[field] = false;
    }

    const amenityLabel = BOOL_CARACTERISTICA_TO_AMENITY[nombre];
    if (amenityLabel) {
      if (idValor === '1') amenities.add(amenityLabel);
      continue;
    }

    if (idValor === '1' && nombre.startsWith('AMBIENTES|')) {
      const f = field?.toLowerCase().replace(/_/g, ' ') ?? '';
      if (f) amenities.add(f);
    }
  }

  const details: ListingDetailsFromIngest = {
    sourceFormat: 'zonaprop_opennavent',
    principales,
    ambientes: Object.keys(ambientes).length ? ambientes : undefined,
    catalog: Object.keys(catalog).length ? catalog : undefined,
    amenities: Array.from(amenities),
    caracteristicasRaw: caracteristicasRaw.slice(0, 400),
  };

  if (amenities.has('pileta')) details.pileta = true;
  if (amenities.has('cochera')) details.cochera = true;
  if (amenities.has('jardín') || ambientes.JARDIN === true) details.jardin = true;
  if (amenities.has('parrilla')) details.parrilla = true;
  if (amenities.has('gimnasio')) details.gimnasio = true;

  return { bedrooms, bathrooms, areaTotal, areaCovered, details };
}

function collectImagenesOpenNavent(block: string): { url: string; order: number }[] {
  const multimedia = block.match(/<multimedia>[\s\S]*?<\/multimedia>/i)?.[0] ?? block;
  const imagenesSec = multimedia.match(/<imagenes>[\s\S]*?<\/imagenes>/i)?.[0] ?? multimedia;
  const imgBlocks = imagenesSec.match(/<imagen>[\s\S]*?<\/imagen>/gi) || [];
  const out: { url: string; order: number }[] = [];
  let order = 0;
  for (const ib of imgBlocks) {
    const url = getXmlText(ib, 'urlImagen');
    if (url) {
      out.push({ url, order });
      order += 1;
    }
  }
  return out;
}

function parseOpenNaventAviso(block: string): Record<string, unknown> | null {
  const codigo = getXmlText(block, 'codigoAviso');
  if (!codigo) return null;

  const tipoBlock = block.match(/<tipoDePropiedad>[\s\S]*?<\/tipoDePropiedad>/i)?.[0] ?? '';
  const tipoNombre = getXmlText(tipoBlock, 'tipo');
  const propertyType = mapTipoTextoToPropertyType(tipoNombre);

  const precio = pickPrecioOpenNavent(block);
  const oper = (precio?.operacion || '').toUpperCase();
  const operationType = oper === 'ALQUILER' || oper === 'RENT' ? 'RENT' : 'SALE';

  const pubBlock = block.match(/<publicador>[\s\S]*?<\/publicador>/i)?.[0] ?? '';
  const publisherRef = getXmlText(pubBlock, 'codigoInmobiliaria');

  const locBlock = block.match(/<localizacion>[\s\S]*?<\/localizacion>/i)?.[0] ?? '';
  const locationText = trunc(
    getXmlText(locBlock, 'Ubicacion') || getXmlText(locBlock, 'ubicacion')
  );
  const addressText = getXmlText(locBlock, 'direccion');
  const lat = parseNum(getXmlText(locBlock, 'latitud'));
  const lng = parseNum(getXmlText(locBlock, 'longitud'));

  const { bedrooms, bathrooms, areaTotal, areaCovered, details } =
    parseCaracteristicasOpenNavent(block);

  const images = collectImagenesOpenNavent(block);
  const refKey = getXmlText(block, 'claveReferencia');
  if (refKey) (details as Record<string, unknown>).referenceKey = refKey;
  const zonapropLocId = getXmlText(locBlock, 'idUbicacion');
  if (zonapropLocId) (details as Record<string, unknown>).zonapropLocationId = zonapropLocId;
  const mapMode = getXmlText(locBlock, 'muestraMapa');
  if (mapMode) (details as Record<string, unknown>).mapDisplayMode = mapMode;
  const maint = getXmlText(block, 'valorMantenimiento');
  if (maint) (details as Record<string, unknown>).maintenanceFee = maint;

  return {
    _parser: 'opennavent',
    id: codigo,
    title: getXmlText(block, 'titulo'),
    description: getXmlText(block, 'descripcion'),
    operation_type: operationType === 'RENT' ? 'rent' : 'sale',
    property_type: propertyType.toLowerCase(),
    price: precio?.monto != null ? String(precio.monto) : null,
    currency: precio?.moneda || 'USD',
    bedrooms: bedrooms != null ? String(bedrooms) : null,
    bathrooms: bathrooms != null ? String(bathrooms) : null,
    area_total: areaTotal != null ? String(areaTotal) : null,
    area_covered: areaCovered != null ? String(areaCovered) : null,
    latitude: lat != null ? String(lat) : null,
    longitude: lng != null ? String(lng) : null,
    address: addressText,
    location_text: locationText || trunc(addressText),
    publisher_ref: publisherRef,
    status: 'active',
    updated_at: getXmlText(block, 'fechaModificacion') || getXmlText(block, 'fechaPublicacion'),
    images,
    detailsPayload: details,
  };
}

function parseOpenNaventXml(buffer: string): Record<string, unknown>[] {
  const blocks = buffer.match(/<Aviso\b[^>]*>[\s\S]*?<\/Aviso>/gi) || [];
  const out: Record<string, unknown>[] = [];
  for (const b of blocks) {
    const row = parseOpenNaventAviso(b);
    if (row) out.push(row);
  }
  return out;
}

/**
 * Parsea XML Zonaprop: formato OpenNavent (`<Aviso>`) o legacy de tests (`<listing>`).
 * Exportado para tests unitarios.
 */
export function parseZonapropXmlDocument(buffer: string): Record<string, unknown>[] {
  const s = buffer.trim();
  if (/<Aviso\b/i.test(s)) {
    return parseOpenNaventXml(s);
  }
  return parseLegacyListingsXml(s);
}

export function createKitepropDifusionZonapropConnector(): SourceConnector {
  const useFixture = process.env.KITEPROP_DIFUSION_ZONAPROP_MODE === 'fixture';
  const fixtureVariant = process.env.KITEPROP_DIFUSION_ZONAPROP_FIXTURE || 'legacy';
  const fixturePath = fixtureVariant === 'opennavent' ? FIXTURE_OPENNAVENT : FIXTURE_LEGACY;
  const fetchUrl = process.env.KITEPROP_DIFUSION_ZONAPROP_URL || DEFAULT_URL;

  return {
    source: 'KITEPROP_DIFUSION_ZONAPROP' as ListingSource,
    fetchBatch: async ({ cursor, limit }) => {
      let xml: string;
      if (useFixture) {
        xml = readFileSync(fixturePath, 'utf-8');
      } else {
        const res = await fetch(fetchUrl, { redirect: 'follow' });
        if (!res.ok) throw new Error('Zonaprop difusion fetch failed: ' + res.status);
        xml = await res.text();
      }
      const items = parseZonapropXmlDocument(xml);
      const start = cursor ? parseInt(cursor, 10) || 0 : 0;
      const slice = items.slice(start, start + limit);
      const nextCursor = start + slice.length < items.length ? String(start + slice.length) : null;
      return { items: slice, nextCursor };
    },
    normalize: (raw) => {
      const parser = raw._parser as string | undefined;
      const images = Array.isArray(raw.images)
        ? (raw.images as { url?: string; order?: number }[])
        : [];

      if (parser === 'opennavent') {
        const op = String(raw.operation_type ?? 'sale').toLowerCase();
        const pt = String(raw.property_type ?? 'apartment').toLowerCase();
        const details = (raw.detailsPayload as ListingDetailsFromIngest) ?? {};
        const areaTotal = parseNum(raw.area_total);
        const areaCovered = parseNum(raw.area_covered);
        return {
          source: 'KITEPROP_DIFUSION_ZONAPROP' as ListingSource,
          externalId: String(raw.id ?? ''),
          publisherRef: raw.publisher_ref ? String(raw.publisher_ref) : null,
          status: 'ACTIVE',
          title: raw.title ? String(raw.title) : null,
          description: raw.description ? String(raw.description) : null,
          operationType: op === 'rent' ? 'RENT' : 'SALE',
          propertyType: PROPERTY_TYPE_MAP[pt] ?? mapTipoTextoToPropertyType(pt),
          currency: raw.currency ? String(raw.currency).toUpperCase() : 'USD',
          price: parseNum(raw.price),
          bedrooms: parseNum(raw.bedrooms),
          bathrooms: parseNum(raw.bathrooms),
          areaTotal: areaTotal ?? undefined,
          areaCovered: areaCovered ?? undefined,
          lat: parseNum(raw.latitude),
          lng: parseNum(raw.longitude),
          addressText: raw.address ? String(raw.address) : null,
          locationText: trunc((raw.location_text as string) || (raw.address as string) || null),
          updatedAtSource: raw.updated_at ? new Date(String(raw.updated_at)) : null,
          mediaUrls: images
            .filter((img) => img?.url)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((img, i) => ({ url: String(img.url), sortOrder: i })),
          details: Object.keys(details).length ? details : null,
        };
      }

      const id = String(raw.id ?? '');
      const op = String(raw.operation_type ?? 'sale').toLowerCase();
      const pt = String(raw.property_type ?? 'apartment').toLowerCase();
      const status = String(raw.status ?? 'active').toLowerCase();
      const locationText = trunc((raw.location_text as string) || (raw.address as string) || null);
      return {
        source: 'KITEPROP_DIFUSION_ZONAPROP' as ListingSource,
        externalId: id,
        publisherRef: raw.publisher_ref ? String(raw.publisher_ref) : null,
        status: status === 'inactive' ? 'INACTIVE' : 'ACTIVE',
        title: raw.title ? String(raw.title) : null,
        description: raw.description ? String(raw.description) : null,
        operationType: op === 'rent' ? 'RENT' : 'SALE',
        propertyType: PROPERTY_TYPE_MAP[pt] ?? 'APARTMENT',
        currency: raw.currency ? String(raw.currency).toUpperCase() : 'USD',
        price: parseNum(raw.price),
        bedrooms: parseNum(raw.bedrooms),
        bathrooms: parseNum(raw.bathrooms),
        areaTotal: parseNum(raw.area_total),
        lat: parseNum(raw.latitude),
        lng: parseNum(raw.longitude),
        addressText: raw.address ? String(raw.address) : null,
        locationText,
        updatedAtSource: raw.updated_at ? new Date(String(raw.updated_at)) : null,
        mediaUrls: images
          .filter((img) => img?.url)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((img, i) => ({ url: String(img.url), sortOrder: i })),
      };
    },
  };
}
