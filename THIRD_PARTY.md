# Materiali di terzi

## Quartieri di Roma 2026 (romaquartieri.it) · Urbe Hub
Repository: https://github.com/urbe-hub/quartieri-roma-2026

- **Logica della vista 3D** (gerarchia Roma → Municipio → area, altezze delle tessere per tipo `H_TIPO`, velo bianco sulle zone fuori livello) riportata su Mapbox in `src/features/map/areas.ts` e `src/features/venues/components/VenuesMap.tsx`. Codice sotto licenza MIT:

  > MIT License — Copyright (c) 2026 Urbe Hub
  >
  > Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
  >
  > The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
  >
  > THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

- **Dati** (non coperti dalla MIT, con le loro condizioni):
  - `public/geo/quartieri.json`: quartieri, rioni e zone funzionali della deliberazione n. 150/2026, Roma Capitale, geoportale GeoRoma. Dati aperti (art. 52 c. 2 CAD), fonte Roma Capitale. Versione semplificata del repo, coordinate arrotondate.
  - `public/geo/municipi.json`: confini dei Municipi da OpenStreetMap (admin_level=9), © OpenStreetMap contributors, ODbL 1.0. Dato derivato: stessa licenza e attribuzione.
- Il nome e il logo di Urbe Hub non sono usati.
