import { config } from '../config';
const environment = import.meta.env;
export const siteUrl = environment.SITE_URL || 'http://localhost:8080';
export const labOrigin = environment.LAB_ORIGIN || 'http://localhost:8081';
export function destinations(kind: 'tools' | 'experiments') {
  return config[kind].map((item) => {
    const url = environment[item.urlEnv] || new URL(`${kind}/${item.slug}/`, labOrigin).href;
    const target = new URL(url);
    if (!['http:', 'https:'].includes(target.protocol) || target.origin === new URL(siteUrl).origin)
      throw new Error('Tools and experiments require a separate HTTP(S) origin');
    return { ...item, url };
  });
}
