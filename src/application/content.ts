import { getCollection } from 'astro:content';
import { config } from '../config';
import { published, validateReferences, placesSchema, relationsSchema } from '../domain/content';
import placesData from '../data/places.json';
import relationsData from '../data/relations.json';
export const places = placesSchema.parse(placesData);
export const relations = relationsSchema.parse(relationsData);
export async function content() {
  const entries = await getCollection('blog');
  validateReferences(entries, config.categories, places, relations);
  const articles = published(entries),
    ids = new Set(articles.map((a) => a.id));
  return {
    articles,
    categories: config.categories
      .map((c) => ({ ...c, articles: articles.filter((a) => a.data.category === c.slug) }))
      .filter((c) => c.articles.length),
    relations: relations.filter(
      (r) => r.status === 'definite' && ids.has(r.source) && ids.has(r.target),
    ),
    places,
  };
}
