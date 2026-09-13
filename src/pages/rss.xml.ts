import rss from '@astrojs/rss';
import { content } from '../application/content';
import { config } from '../config';
import { siteUrl } from '../application/destinations';
export async function GET() {
  return rss({
    title: config.name,
    description: config.description,
    site: siteUrl,
    items: (await content()).articles.map((a) => ({
      title: a.data.title,
      description: a.data.description,
      pubDate: a.data.date,
      link: `/blog/${a.id}/`,
    })),
  });
}
