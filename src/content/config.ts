import { defineCollection, z } from 'astro:content';

const reply = z.object({
  author: z.string(),
  createdAt: z.coerce.date(),
  body: z.string(),
});

const comment = z.object({
  author: z.string(),
  createdAt: z.coerce.date(),
  body: z.string(),
  replies: z.array(reply).optional().default([]),
});

const posts = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    author: z.string(),
    createdAt: z.coerce.date(),
    body: z.string(),
    comments: z.array(comment).optional().default([]),
  }),
});

const boards = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    description: z.string().optional().default(''),
    category: z.string(),
    order: z.number().optional().default(100),
  }),
});

export const collections = { posts, boards };
