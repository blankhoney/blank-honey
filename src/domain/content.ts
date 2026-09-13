import { z } from 'zod';
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const articleSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  date: z.coerce.date(),
  category: slugSchema,
  tags: z.array(z.string().min(1)).default([]),
  draft: z.boolean().default(false),
  places: z.array(slugSchema).default([]),
});
const coordinates = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export const placesSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(
    z.object({
      type: z.literal('Feature'),
      geometry: z.object({ type: z.literal('Point'), coordinates }),
      properties: z.object({
        slug: slugSchema,
        name: z.string(),
        country: z.string(),
        visited: z.boolean(),
        landmarks: z.array(z.object({ name: z.string(), coordinates })).default([]),
      }),
    }),
  ),
});
export const relationsSchema = z.array(
  z.object({
    source: slugSchema,
    target: slugSchema,
    label: z.string().min(1),
    status: z.enum(['definite', 'tentative']),
  }),
);
export type Article = { id: string; data: z.infer<typeof articleSchema> };
export function published<T extends Article>(items: T[]): T[] {
  return items
    .filter((a) => !a.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || a.id.localeCompare(b.id));
}
export function neighbors<T extends Article>(items: T[], id: string) {
  const all = published(items),
    index = all.findIndex((a) => a.id === id);
  if (index < 0) return { newer: undefined, older: undefined };
  const same = all.filter((a) => a.data.category === all[index].data.category),
    local = same.findIndex((a) => a.id === id);
  return { newer: same[local - 1] ?? all[index - 1], older: same[local + 1] ?? all[index + 1] };
}
export function validateReferences(
  items: Article[],
  categories: readonly { slug: string }[],
  places: z.infer<typeof placesSchema>,
  relations: z.infer<typeof relationsSchema>,
) {
  const ids = new Set(items.map((a) => a.id)),
    cats = new Set(categories.map((c) => c.slug)),
    points = new Set(places.features.map((p) => p.properties.slug));
  if (
    ids.size !== items.length ||
    cats.size !== categories.length ||
    points.size !== places.features.length
  )
    throw new Error('Duplicate content identifier');
  for (const article of items) {
    if (!cats.has(article.data.category)) throw new Error(`Unknown category: ${article.id}`);
    if (article.data.places.some((id) => !points.has(id)))
      throw new Error(`Unknown place: ${article.id}`);
  }
  for (const edge of relations)
    if (!ids.has(edge.source) || !ids.has(edge.target))
      throw new Error('Unknown relation endpoint');
}
