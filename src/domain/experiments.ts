import { z } from 'zod';
import { slugSchema } from './content';

export const experimentPath = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/)
  .refine(
    (path) => path.split('/').every((part) => part && !part.startsWith('.')),
    'Expected a relative public file path',
  );
const publicUrl = z.url().refine((value) => {
  const url = new URL(value);
  return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
});
export const experimentsSchema = z
  .array(
    z
      .object({
        slug: slugSchema,
        title: z.string().min(1),
        description: z.string().min(1),
        directory: experimentPath,
        entry: experimentPath,
        preview: z.string().optional(),
        prompt: z.string().min(1),
        modelId: z.string().min(1),
        reasoningEffort: z.string().min(1),
        generatedAt: z
          .string()
          .refine((value) => Number.isFinite(Date.parse(value)), 'Invalid date'),
        author: z.object({ name: z.string().min(1), sourceUrl: publicUrl }),
        promptVersion: z.string().min(1),
        run: z.object({
          singleUserTask: z.boolean(),
          agentTools: z.boolean(),
          selfCheck: z.string().min(1),
          environment: z.string().optional(),
          additionalInstructions: z.string().optional(),
        }),
        observations: z.array(z.string()),
      })
      .refine(
        (item) => item.directory === `examples/benchmarks/${item.slug}`,
        'Unexpected benchmark directory',
      )
      .refine(
        (item) => item.preview === undefined || item.preview === `/benchmarks/${item.slug}.webp`,
        'Expected the local benchmark preview path',
      ),
  )
  .refine(
    (items) => new Set(items.map((item) => item.slug)).size === items.length,
    'Duplicate benchmark slug',
  );
export type Experiment = z.infer<typeof experimentsSchema>[number];
