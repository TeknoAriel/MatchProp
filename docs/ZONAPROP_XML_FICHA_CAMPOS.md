# Plan de campos: XML Zonaprop / KiteProp (OpenNavent)

Fuente analizada: feed estilo  
`https://static.kiteprop.com/kp/difusions/.../zonaprop.xml`  
Raíz: `<OpenNavent><Avisos>`; cada publicación: `<Aviso>...</Aviso>`.

> **Nota:** El fixture `apps/api/src/services/ingest/fixtures/zonaprop-sample.xml` del repo usa otro esquema (`<listings><listing>`). El conector `kiteprop-difusion-zonaprop.ts` hoy parsea ese formato de prueba; **en producción hay que parsear OpenNavent** como en este documento.

---

## 1. Bloques principales de `<Aviso>`

| XML (tag)                                             | Uso                          | Campo canónico MatchProp / Prisma                                   |
| ----------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| `codigoAviso`                                         | ID numérico del aviso        | `externalId` (string)                                               |
| `claveReferencia`                                     | Referencia interna (ej. KP…) | `publisherRef` auxiliar o `details.referenceKey`                    |
| `titulo`                                              | Título                       | `title`                                                             |
| `descripcion`                                         | Texto largo                  | `description`                                                       |
| `tipoDePropiedad` → `idTipo`, `tipo`                  | Tipo texto (Casa, Depto…)    | `propertyType` (mapear a HOUSE/APARTMENT/…)                         |
| `precios` → `precio` → `monto`, `moneda`, `operacion` | VENTA / ALQUILER + importe   | `operationType` (SALE/RENT), `price`, `currency`                    |
| `publicador`                                          | Inmobiliaria / contacto      | `publisherRef` = `codigoInmobiliaria`; resto en `details.publisher` |
| `publicacion` → `tipoDePublicacion`                   | HOME, etc.                   | `details.publicationType`                                           |
| `multimedia` → `imagenes` → `imagen` → `urlImagen`    | Fotos                        | `ListingMedia` + `heroImageUrl`                                     |
| `multimedia` → `planos` → `plano` → URLs              | Planos                       | `details.planos[]`                                                  |
| `multimedia` → `videos` → `video`                     | YouTube / URL                | `details.videos[]`                                                  |
| `multimedia` → `recorridos360`                        | Tour 360                     | `details.recorridos360[]`                                           |
| `localizacion`                                        | Dirección y mapa             | ver tabla siguiente                                                 |

### 1.1 `localizacion`

| XML                        | Campo canónico                       |
| -------------------------- | ------------------------------------ |
| `Ubicacion`                | `locationText` (texto completo zona) |
| `idUbicacion`              | `details.zonapropLocationId`         |
| `direccion`                | `addressText`                        |
| `latitud` / `longitud`     | `lat` / `lng`                        |
| `muestraMapa` (EXACTO / …) | `details.mapDisplayMode`             |
| `codigoPostal`             | `details.postalCode`                 |

### 1.2 Extras frecuentes

| XML                  | Uso                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `valorMantenimiento` | Gastos / expensas (típico alquiler) → `details.maintenanceFee` + moneda si viene en otro tag |

---

## 2. `caracteristicas` → plan de ficha y amenities

Cada ítem:

```xml
<caracteristica>
  <nombre><![CDATA[CATEGORIA|CAMPO]]></nombre>
  <idValor><![CDATA[...]]></idValor>   <!-- opcional: 0/1 o código catálogo -->
</caracteristica>
```

o, para medidas / contadores:

```xml
<caracteristica>
  <nombre><![CDATA[PRINCIPALES|DORMITORIO]]></nombre>
  <valor><![CDATA[5]]></valor>
</caracteristica>
```

### 2.1 Semántica de valores

- **`idValor` `0` / `1`:** en la práctica = **No / Sí** (amenity booleana).
- **`idValor` numérico grande** (ej. `1000048`, `1000051`): **ID de catálogo** Zonaprop (luminosidad, orientación, tipo cochera, etc.) → guardar en `details.caracteristicas[CATEGORIA|CAMPO] = { kind: 'catalog', id: n }` y opcionalmente resolver etiqueta con tabla auxiliar.
- **`<valor>` texto/ número:** medida o cantidad (m², cantidad de baños, etc.).

### 2.2 Mapeo a “ficha” (alineado con capturas de KiteProp)

Convención interna sugerida: clave = `categoria.campo` en minúsculas, con `_` en lugar de `|`.

#### PRINCIPALES (Detalles / núcleo)

| `nombre` en XML | Etiqueta ficha (referencia UI) | Tipo                       | Campo interno sugerido |
| --------------- | ------------------------------ | -------------------------- | ---------------------- | --------------------------------------------------------------------------------------- |
| `PRINCIPALES    | AMBIENTE`                      | Ambientes                  | número                 | `details.principales.ambiente` → también puede alimentar `bedrooms` si no hay otro dato |
| `PRINCIPALES    | DORMITORIO`                    | Dormitorios                | número                 | `bedrooms`                                                                              |
| `PRINCIPALES    | BANO`                          | Baños                      | número                 | `bathrooms`                                                                             |
| `PRINCIPALES    | COCHERA`                       | Estacionamientos / cochera | número                 | `details.principales.cochera` + flag `details.amenities.cochera` si ≥ 1                 |
| `PRINCIPALES    | ANTIGUEDAD`                    | Año / antigüedad           | número                 | `details.principales.antiguedad`                                                        |
| `PRINCIPALES    | TOILETTE`                      | Toilette                   | número                 | `details.principales.toilette`                                                          |

#### MEDIDAS / GENERALES (Superficies)

| `nombre` en XML | Etiqueta ficha               | Tipo                | Campo interno |
| --------------- | ---------------------------- | ------------------- | ------------- | ------------------------------- |
| `MEDIDAS        | SUPERFICIE_TOTAL`            | Superficie total    | m²            | `areaTotal`                     |
| `MEDIDAS        | SUPERFICIE_CUBIERTA`         | Superficie cubierta | m²            | `areaCovered`                   |
| `MEDIDAS        | UNIDAD_DE_MEDIDA`            | Unidad              | texto         | `details.medidas.unidad`        |
| `GENERALES      | SUPERFICIE*DEL_TERRENO*(M2)` | Dimensión terreno   | m²            | `details.superficieTerreno`     |
| `GENERALES      | SUPERFICIE*DESCUBIERTA*(M2)` | Descubierta         | m²            | `details.superficieDescubierta` |
| `GENERALES      | SUPERFICIE*DE_PLAYA*(M2)`    | Playa (lote)        | m²            | `details.superficiePlaya`       |

#### GENERALES (Amenities / comercial / accesibilidad)

| `nombre` en XML | Etiqueta / uso en UI                         | `idValor` típico        | `amenities` / `details` |
| --------------- | -------------------------------------------- | ----------------------- | ----------------------- | ------------------------------------ |
| `GENERALES      | PILETA`                                      | Pileta / piscina        | 0/1                     | `pileta`, array `amenities`          |
| `GENERALES      | PARRILLA`                                    | Parrilla / quincho ext. | 0/1                     | `parrilla`                           |
| `GENERALES      | GIMNASIO`                                    | Gimnasio                | 0/1                     | `gimnasio`                           |
| `GENERALES      | SOLARIUM`                                    | Solarium                | 0/1                     | `solarium`                           |
| `GENERALES      | HIDROMASAJE`                                 | Hidromasaje             | 0/1                     | `hidromasaje`                        |
| `GENERALES      | LUMINOSO`                                    | Luminosidad             | catálogo                | `details.catalog.luminosidadId`      |
| `GENERALES      | ORIENTACION`                                 | Orientación             | catálogo                | `details.catalog.orientacionId`      |
| `GENERALES      | COBERTURA_COCHERA`                           | Cobertura cochera       | catálogo                | `details.catalog.coberturaCocheraId` |
| `GENERALES      | CANTIDAD_DE_PLANTAS`                         | Cantidad plantas        | catálogo                | `details.catalog.cantidadPlantasId`  |
| `GENERALES      | USO_COMERCIAL`                               | Uso comercial           | 0/1                     | `usoComercial`                       |
| `GENERALES      | APTO_PROFESIONAL`                            | Apto profesional        | 0/1                     | `aptoProfesional`                    |
| `GENERALES      | PERMITE_MASCOTAS`                            | Mascotas                | 0/1                     | `aceptaMascotas`                     |
| `GENERALES      | ACCESO_PARA_PERSONAS_CON_MOVILIDAD_REDUCIDA` | Accesibilidad           | 0/1                     | `accesoMovilidadReducida`            |

> **Apto crédito:** si en otros feeds aparece como `GENERALES|APTO_CREDITO` o similar, mapear a `details.aptoCredito` (ya usado en feed).

#### AMBIENTES (checkboxes tipo “tiene X”)

| `nombre` en XML | Etiqueta típica          |
| --------------- | ------------------------ | ------------------------------- |
| `AMBIENTES      | COCINA`                  | Cocina                          |
| `AMBIENTES      | COMEDOR`                 | Comedor                         |
| `AMBIENTES      | LIVING`                  | Living                          |
| `AMBIENTES      | LIVING_COMEDOR`          | Living comedor                  |
| `AMBIENTES      | COMEDOR_DIARIO`          | Comedor de diario / desayunador |
| `AMBIENTES      | PATIO`                   | Patio                           |
| `AMBIENTES      | JARDIN`                  | Jardín                          |
| `AMBIENTES      | TERRAZA`                 | Terraza                         |
| `AMBIENTES      | BALCON`                  | Balcón                          |
| `AMBIENTES      | LAVADERO`                | Lavadero                        |
| `AMBIENTES      | VESTIDOR`                | Vestidor                        |
| `AMBIENTES      | DORMITORIO_EN_SUITE`     | Dormitorio en suite             |
| `AMBIENTES      | ESCRITORIO`              | Escritorio / estudio            |
| `AMBIENTES      | DEPENDENCIA_DE_SERVICIO` | Dependencia                     |
| `AMBIENTES      | BAULERA`                 | Baulera                         |
| `AMBIENTES      | ALTILLO`                 | Altillo                         |
| `AMBIENTES      | SOTANO`                  | Sótano                          |
| `AMBIENTES      | HALL`                    | Hall                            |
| `AMBIENTES      | PLAYROOM`                | Playroom (si aparece)           |

Guardar como `details.ambientes.CAMPO = true/false` y/o aplanar a `details.amenities[]` con nombres estables (`jardín`, `patio`, …) para el asistente de búsqueda.

#### OTROS (electro / confort)

| `nombre` en XML | Etiqueta típica     |
| --------------- | ------------------- | ------------------------- |
| `OTROS          | AIRE_ACONDICIONADO` | Aire acondicionado        |
| `OTROS          | CALEFACCION`        | Calefacción               |
| `OTROS          | CALDERA`            | Caldera                   |
| `OTROS          | CHIMENEA`           | Chimenea                  |
| `OTROS          | ALARMA`             | Alarma                    |
| `OTROS          | COCINA_EQUIPADA`    | Cocina equipada           |
| `OTROS          | LAVAVAJILLAS`       | Lavavajillas              |
| `OTROS          | LAVARROPAS`         | Lavarropas                |
| `OTROS          | SECARROPAS`         | Secarropas                |
| `OTROS          | MICROONDAS`         | Microondas                |
| `OTROS          | FRIGOBAR`           | Frigobar                  |
| `OTROS          | TERMOTANQUE`        | Termotanque               |
| `OTROS          | QUINCHO`            | Quincho                   |
| `OTROS          | SAUNA`              | Sauna                     |
| `OTROS          | VIGILANCIA`         | Vigilancia                |
| `OTROS          | CANCHA_DE_DEPORTES` | Cancha deportes           |
| `OTROS          | AGUA_CORRIENTE`     | Agua corriente (si viene) |
| `OTROS          | AMOBLADO`           | Amoblado (si viene)       |

#### SERVICIOS

| `nombre` en XML | Etiqueta típica       |
| --------------- | --------------------- | ---------------------- |
| `SERVICIOS      | ASCENSOR`             | Ascensor               |
| `SERVICIOS      | INTERNET/WIFI`        | Internet / WiFi        |
| `SERVICIOS      | ENCARGADO`            | Encargado / vigilancia |
| `SERVICIOS      | SERVICIO_DE_LIMPIEZA` | Limpieza               |
| `SERVICIOS      | ROPA_DE_CAMA`         | Ropa de cama           |
| `SERVICIOS      | TOALLAS`              | Toallas                |

#### AGRUPADORA

Metadatos de agrupación en portales (ej. `AGRUPADORA|COCINAS`, `LIVING_COMEDOR`, `CANCHA_DE_DEPORTES`). Útiles para **debug / trazabilidad**; opcional en UI.

---

## 3. JSON `Listing.details` recomendado (shape)

Para unificar XML + futuras APIs:

```json
{
  "sourceFormat": "zonaprop_opennavent",
  "referenceKey": "KP496363",
  "principales": { "ambiente": 8, "toilette": 2, "antiguedad": 39 },
  "catalog": {
    "luminosidadId": "1000048",
    "orientacionId": "1000051",
    "coberturaCocheraId": "1000026",
    "cantidadPlantasId": "1000018"
  },
  "ambientes": {
    "PATIO": true,
    "JARDIN": true,
    "TERRAZA": true,
    "LAVADERO": true
  },
  "amenities": [
    "pileta",
    "parrilla",
    "cochera",
    "aire acondicionado",
    "calefacción",
    "internet wifi",
    "apto profesional",
    "mascotas"
  ],
  "aptoCredito": null,
  "planos": [{ "url": "..." }],
  "videos": [{ "url": "...", "titulo": "..." }],
  "recorridos360": [{ "url": "...", "titulo": "..." }],
  "caracteristicasRaw": [{ "nombre": "GENERALES|PILETA", "idValor": "1" }]
}
```

- `caracteristicasRaw`: opcional, para no perder datos si aparecen claves nuevas.
- `amenities`: lista **normalizada** para búsqueda asistente + filtros por texto en `title`/`description` (como hoy) o futuros filtros JSON.

---

## 4. Próximo paso de implementación

1. **Reemplazar** `parseZonapropXml` en `kiteprop-difusion-zonaprop.ts` por parser OpenNavent (`<Aviso>`, CDATA).
2. **URL configurable** (env / `ingestSourceConfig`) apuntando al `zonaprop.xml` real del cliente.
3. **Mapear** `caracteristicas` → `NormalizedListing.details` + `bedrooms`/`bathrooms` desde `PRINCIPALES|*`.
4. **Tabla opcional** `ZonapropCatalogValue` (id → etiqueta ES) para resolver `idValor` de catálogo en UI.

Este documento es el **plan de campos** compartido entre ingest, ficha en frontend y criterios del asistente.
