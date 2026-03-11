# Kiteprop Listing Fields y ListingDTO

**Contrato:** GET `/listings/:id` (ListingDTO) y mapeo desde fuentes Kiteprop.

---

## ListingDTO (respuesta GET /listings/:id)

| Campo         | Tipo           | Descripción                                         |
| ------------- | -------------- | --------------------------------------------------- |
| id            | string         | ID interno                                          |
| source        | string         | Fuente (KITEPROP_EXTERNALSITE, API_PARTNER_1, etc.) |
| externalId    | string         | ID en la fuente externa                             |
| title         | string \| null | Título                                              |
| description   | string \| null | Descripción                                         |
| operationType | string \| null | SALE, RENT                                          |
| propertyType  | string \| null | HOUSE, APARTMENT, LAND, OFFICE, OTHER               |
| price         | number \| null | Precio                                              |
| currency      | string \| null | USD, ARS                                            |
| bedrooms      | number \| null | Dormitorios                                         |
| bathrooms     | number \| null | Baños                                               |
| areaTotal     | number \| null | Superficie total m²                                 |
| areaCovered   | number \| null | Superficie cubierta m²                              |
| lat           | number \| null | Latitud                                             |
| lng           | number \| null | Longitud                                            |
| addressText   | string \| null | Dirección                                           |
| locationText  | string \| null | Zona/barrio/ciudad                                  |
| heroImageUrl  | string \| null | URL imagen principal                                |
| photosCount   | number         | Cantidad de fotos                                   |
| details       | object \| null | Amenities, services, aptoCredito, etc.              |
| media         | array          | { url, sortOrder }[]                                |

---

## Mapeo Kiteprop → Listing (ingest)

| Campo Kiteprop                | Campo Listing        |
| ----------------------------- | -------------------- |
| id                            | externalId           |
| title                         | title                |
| description                   | description          |
| operationType                 | operationType        |
| propertyType                  | propertyType         |
| price                         | price                |
| currency                      | currency             |
| bedrooms                      | bedrooms             |
| bathrooms                     | bathrooms            |
| areaTotalM2                   | areaTotal            |
| areaCoveredM2                 | areaCovered          |
| lat                           | lat                  |
| lng                           | lng                  |
| addressText                   | addressText          |
| neighborhood / city           | locationText         |
| heroImageUrl                  | heroImageUrl         |
| amenities                     | details.amenities    |
| services                      | details.services     |
| aptoCredito                   | details.aptoCredito  |
| floor, orientation, yearBuilt | details (opcionales) |

---

## Ejemplo Kiteprop

Ver `docs/kiteprop-listing-example.json` para payload de ejemplo.

---

_Documentación alineada con plan-completamiento-100 Fase 1.5._
