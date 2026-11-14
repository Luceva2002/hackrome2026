/** Punto nel poligono per i confini di municipi e quartieri (usato da mappa e server). */
export type Ring = [number, number][];
export type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };

export const polygons = (g: Geometry): Ring[][] => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);

function inRing(x: number, y: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const inGeometry = (x: number, y: number, polys: Ring[][]) =>
  polys.some(([outer, ...holes]) => inRing(x, y, outer) && !holes.some((h) => inRing(x, y, h)));
