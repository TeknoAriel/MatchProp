# Arquitectura de Imágenes - MatchProp

## Escenario de Escalabilidad

| Métrica | Actual | Target |
|---------|--------|--------|
| Propiedades | 15,613 | 150,000 |
| Fotos por propiedad | 1 | 10 |
| Total imágenes | 15,613 | 1,500,000 |
| Usuarios concurrentes | 50 | 5,000 |
| Almacenamiento estimado | 3 GB | 300 GB |
| Requests/seg (pico) | 10 | 1,000+ |

---

## Opción 1: CDN del Origen (Actual) ⭐ RECOMENDADA CORTO PLAZO

### Cómo funciona ahora
Las imágenes están en servidores de los portales (Kiteprop, Proppit, etc.) y MatchProp solo guarda las URLs.

```
Usuario → Vercel → API devuelve URL → Navegador carga imagen de static.kiteprop.com
```

### Ventajas
- ✅ Sin costo de almacenamiento
- ✅ Sin costo de transferencia
- ✅ Las imágenes ya están optimizadas por el origen
- ✅ CDN del origen (Cloudflare) maneja el cache

### Desventajas
- ❌ Dependencia de terceros (si Kiteprop cae, no hay fotos)
- ❌ Posible hot-linking bloqueado por algunos portales
- ❌ No control sobre optimización/transformaciones

### Recomendación
**Seguir con esta opción mientras crecemos.** Es costo $0 y funciona.

---

## Opción 2: Proxy + CDN con Transformaciones (Cloudflare Images / imgix)

### Arquitectura
```
Usuario → CDN (Cloudflare/imgix) → Proxy → Origen (kiteprop, etc.)
                ↓
         Cache + Resize + WebP
```

### Implementación con Cloudflare Images
```javascript
// En la API, transformar URLs
const imageUrl = listing.heroImageUrl;
const optimizedUrl = `https://images.matchprop.com/cdn-cgi/image/width=800,quality=80,format=auto/${encodeURIComponent(imageUrl)}`;
```

### Costos (Cloudflare Images)
- $5/mes por 100,000 imágenes almacenadas
- $1 por 100,000 transformaciones
- **Para 1.5M imágenes: ~$75-150/mes**

### Costos (imgix)
- $10/mes base + $3 por 1,000 imágenes origen
- **Para 1.5M imágenes: ~$200-400/mes**

### Ventajas
- ✅ Optimización automática (WebP, AVIF, resize)
- ✅ Cache global
- ✅ Fallback si origen falla
- ✅ Lazy loading optimizado

### Desventajas
- ❌ Costo mensual
- ❌ Configuración inicial

---

## Opción 3: Almacenamiento Propio (S3/R2 + CDN)

### Arquitectura
```
Ingest → Descargar imagen → Subir a R2/S3 → CDN → Usuario
```

### Implementación
```typescript
// Durante ingest, descargar y subir imagen
async function processImage(listing: Listing, imageUrl: string) {
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();
  
  // Generar variantes
  const sizes = [
    { name: 'thumb', width: 200 },
    { name: 'card', width: 600 },
    { name: 'full', width: 1200 }
  ];
  
  for (const size of sizes) {
    const resized = await sharp(buffer).resize(size.width).webp().toBuffer();
    await r2.put(`listings/${listing.id}/${size.name}.webp`, resized);
  }
}
```

### Costos (Cloudflare R2)
- Almacenamiento: $0.015/GB/mes = **300 GB × $0.015 = $4.50/mes**
- Operaciones: $0.36 por millón
- Egress: **GRATIS** con Workers
- **Total estimado: $10-30/mes**

### Costos (AWS S3 + CloudFront)
- S3: $0.023/GB = **300 GB × $0.023 = $6.90/mes**
- CloudFront: $0.085/GB egress
- **Total estimado: $100-500/mes** (depende del tráfico)

### Ventajas
- ✅ Control total sobre las imágenes
- ✅ Independiente de terceros
- ✅ Puedes optimizar y transformar
- ✅ Backup propio

### Desventajas
- ❌ Proceso de ingest más lento
- ❌ Espacio de almacenamiento
- ❌ Complejidad operativa

---

## Opción 4: Elasticsearch/Meilisearch para Metadata (NO para imágenes)

**IMPORTANTE:** Elasticsearch NO es para almacenar imágenes. Es para búsqueda.

### Cuándo usar Elasticsearch/Meilisearch
- Búsqueda full-text en descripciones
- Filtros complejos (geo, rangos, facets)
- Autocompletado

### Para imágenes, NO usar:
- ❌ Elasticsearch
- ❌ MongoDB GridFS
- ❌ Base de datos relacional (blob)

---

## Recomendación por Etapa

### Etapa 1: Actual → 50,000 propiedades
**Mantener URLs externas** (costo $0)
- Las imágenes vienen de Kiteprop/Proppit
- Agregar lazy loading y placeholder

### Etapa 2: 50,000 → 150,000 propiedades
**Cloudflare R2 + Workers**
- Costo bajo (~$30/mes)
- Egress gratis
- Transformaciones con Workers

### Etapa 3: 150,000+ con múltiples integraciones
**Cloudflare Images o imgix**
- Transformaciones automáticas
- CDN global
- ~$150-200/mes

---

## Implementación Inmediata Recomendada

### 1. Agregar lazy loading y placeholders (YA HECHO)
```jsx
<img 
  src={heroImageUrl} 
  loading="lazy"
  onError={(e) => e.currentTarget.style.display = 'none'}
/>
```

### 2. Agregar imagen placeholder con blur (próximo paso)
```typescript
// En la API, generar blurhash para placeholder
const listing = {
  heroImageUrl: '...',
  heroImageBlur: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' // blurhash
};
```

### 3. Agregar proxy de imágenes (opcional, para control)
```typescript
// /api/img/[...path].ts
export default async function handler(req, res) {
  const imageUrl = decodeURIComponent(req.query.path.join('/'));
  const response = await fetch(imageUrl);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Content-Type', response.headers.get('content-type'));
  response.body.pipe(res);
}
```

### 4. Ingestar múltiples fotos (carrusel)
El schema ya tiene `ListingMedia`, solo falta poblarlos en el ingest.

---

## Métricas a Monitorear

- **LCP (Largest Contentful Paint)**: < 2.5s
- **Cache Hit Ratio**: > 90%
- **Error Rate imágenes**: < 1%
- **Tiempo de carga promedio**: < 500ms

---

## Conclusión

| Etapa | Solución | Costo | Complejidad |
|-------|----------|-------|-------------|
| Ahora | URLs externas | $0 | Baja |
| 50K props | R2 + Workers | $30/mes | Media |
| 150K props | Cloudflare Images | $150/mes | Media |
| 500K+ props | Multi-CDN | $500+/mes | Alta |

**Recomendación inmediata:** Seguir con URLs externas y agregar el carrusel de fotos en el ingest.
