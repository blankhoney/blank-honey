import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { articleSchema } from './domain/content';
export const collections = {
  blog: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
    schema: articleSchema,
  }),
};
