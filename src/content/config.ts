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
    topics: z.array(z.string()).optional().default([]),
    body: z.string(),
    comments: z.array(comment).optional().default([]),
  }),
});

export const collections = { posts };
