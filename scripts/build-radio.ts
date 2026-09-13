import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { config } from '../src/config';
export function httpUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Expected a public HTTP(S) URL');
  return url.href;
}
export function enclosure(xml: string): string {
  if (XMLValidator.validate(xml) !== true) throw new Error('Invalid radio RSS');
  const feed = new XMLParser({ ignoreAttributes: false }).parse(xml);
  const items = feed.rss?.channel?.item;
  for (const item of Array.isArray(items) ? items : items ? [items] : []) {
    const entries = Array.isArray(item.enclosure) ? item.enclosure : [item.enclosure];
    for (const entry of entries)
      if (entry?.['@_url'] && (!entry['@_type'] || String(entry['@_type']).startsWith('audio/')))
        return httpUrl(entry['@_url']);
  }
  throw new Error('No audio enclosure in RSS');
}
async function main() {
  const stations = await Promise.all(
    config.radio.flatMap((station) => {
      const input = process.env[station.urlEnv]?.trim();
      if (!input) return [];
      return [
        (async () => {
          try {
            let url = httpUrl(input);
            if (station.source === 'rss') {
              const response = await fetch(url, {
                signal: AbortSignal.timeout(8000),
                redirect: 'error',
              });
              if (!response.ok) throw new Error(`RSS HTTP ${response.status}`);
              const reader = response.body!.getReader();
              const chunks: Uint8Array[] = [];
              let size = 0;
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                size += value.length;
                if (size > 2_000_000) {
                  await reader.cancel();
                  throw new Error('RSS too large');
                }
                chunks.push(value);
              }
              url = enclosure(Buffer.concat(chunks).toString('utf8'));
            }
            return { id: station.id, name: station.name, url, status: 'available' };
          } catch {
            console.warn(`Radio ${station.id}: unavailable`);
            return { id: station.id, name: station.name, url: null, status: 'unavailable' };
          }
        })(),
      ];
    }),
  );
  await mkdir('src/data', { recursive: true });
  await writeFile('src/data/radio.generated.json', JSON.stringify(stations, null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
