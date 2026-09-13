import { report } from './log';
import type { GeoJsonObject } from 'geojson';
import type { placesSchema } from '../domain/content';
import type { z } from 'zod';
export async function mountMap(signal: AbortSignal) {
  const [{ default: L }] = await Promise.all([
    import('leaflet'),
    import('leaflet/dist/leaflet.css'),
  ]);
  if (signal.aborted) return;
  const host = document.querySelector<HTMLElement>('#map')!;
  const data = JSON.parse(document.querySelector('#map-data')!.textContent!) as {
    places: z.infer<typeof placesSchema>;
    tiles: { tileUrl: string; attribution: string; attributionUrl: string; maxZoom: number };
  };
  host.replaceChildren();
  const map = L.map(host, { scrollWheelZoom: false }).setView([27, 28], 2);
  const controls = L.control.attribution({ prefix: false });
  map.attributionControl.remove();
  controls.addTo(map);
  const attr = document.createElement('a');
  attr.href = data.tiles.attributionUrl;
  attr.textContent = data.tiles.attribution;
  attr.rel = 'noopener noreferrer';
  const tiles = L.tileLayer(data.tiles.tileUrl, {
    maxZoom: data.tiles.maxZoom,
    attribution: attr.outerHTML,
  }).addTo(map);
  const status = document.querySelector<HTMLElement>('#map-status')!;
  tiles.on('tileerror', () => {
    status.textContent = '底图暂不可用，地点与文字仍可查看。';
  });
  const points = L.layerGroup(),
    landmarks = L.layerGroup();
  const style = () => getComputedStyle(document.documentElement);
  for (const feature of data.places.features) {
    const p = feature.properties,
      [lng, lat] = feature.geometry.coordinates;
    const marker = L.circleMarker([lat, lng], {
      radius: 5,
      color: style().getPropertyValue('--accent').trim(),
      weight: 1,
      fillColor: p.visited ? '#b6a27a' : '#777d75',
      fillOpacity: p.visited ? 0.9 : 0.3,
    });
    const text = document.createElement('span');
    text.textContent = `${p.name} · ${p.visited ? '已去过' : '未去过'}`;
    marker.bindPopup(text).addTo(points);
    for (const place of p.landmarks) {
      const text = document.createElement('span');
      text.textContent = place.name;
      L.circleMarker([place.coordinates[1], place.coordinates[0]], {
        radius: 3,
        color: '#b6a27a',
        fillOpacity: 1,
      })
        .bindTooltip(text)
        .addTo(landmarks);
    }
    document.querySelector(`[data-place="${p.slug}"]`)?.addEventListener(
      'click',
      () => {
        map.setView([lat, lng], 6);
        marker.openPopup();
      },
      { signal },
    );
  }
  function layers() {
    const zoom = map.getZoom();
    if (zoom >= 3) points.addTo(map);
    else map.removeLayer(points);
    if (zoom >= 5) landmarks.addTo(map);
    else map.removeLayer(landmarks);
  }
  map.on('zoomend', layers);
  layers();
  signal.addEventListener('abort', () => map.remove(), { once: true });
  try {
    const response = await fetch('/world.geojson', { signal });
    if (!response.ok) throw new Error('Map unavailable');
    const world = await response.json();
    if (signal.aborted) return;
    const visited = new Set(
      data.places.features.filter((f) => f.properties.visited).map((f) => f.properties.country),
    );
    L.geoJSON(world as GeoJsonObject, {
      style: (feature) => ({
        color: '#7a8572',
        weight: 0.55,
        fillColor: visited.has(feature?.properties.iso) ? '#758264' : '#434b41',
        fillOpacity: visited.has(feature?.properties.iso) ? 0.6 : 0.2,
      }),
    })
      .addTo(map)
      .bringToBack();
  } catch (error) {
    if (!signal.aborted) report('map', error);
  }
}
