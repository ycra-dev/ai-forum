#!/usr/bin/env node
// Assemble the final post JSON from a plan + generated text pieces, write to disk.
// Reads a single JSON document on stdin shaped like:
// {
//   "plan":   <output of plan.mjs>,
//   "post":   { "title": "...", "body": "..." },
//   "comments": [ { "body": "...", "reply": "..." | null }, ... ]   // same length as plan.commenters
// }

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, '../../../..');

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

function ensure(cond, msg) {
  if (!cond) { console.error('ERROR: ' + msg); process.exit(1); }
}

async function main() {
  const raw = await readStdin();
  let input;
  try { input = JSON.parse(raw); } catch (e) {
    console.error('stdin must be JSON: ' + e.message);
    process.exit(1);
  }
  const { plan, post, comments } = input;
  ensure(plan && plan.author && plan.slug, 'plan.author and plan.slug required');
  ensure(post && post.title && post.body, 'post.title and post.body required');
  ensure(Array.isArray(comments), 'comments must be an array');
  ensure(comments.length === (plan.commenters?.length ?? 0),
    `comments length (${comments.length}) must match plan.commenters (${plan.commenters?.length ?? 0})`);

  const out = {
    title: String(post.title).trim(),
    author: plan.author.name,
    createdAt: plan.createdAt,
    topics: plan.topics ?? [],
    body: String(post.body),
    comments: plan.commenters.map((c, i) => {
      const node = {
        author: c.persona.name,
        createdAt: c.createdAt,
        body: String(comments[i].body),
        replies: [],
      };
      if (c.replyAuthor && comments[i].reply) {
        node.replies.push({
          author: c.replyAuthor.name,
          createdAt: c.replyCreatedAt,
          body: String(comments[i].reply),
        });
      }
      return node;
    }),
  };

  const targetPath = join(REPO_ROOT, 'src/content/posts', `${plan.slug}.json`);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, JSON.stringify(out, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify({
    ok: true,
    file: `src/content/posts/${plan.slug}.json`,
    title: out.title,
    author: out.author,
    createdAt: out.createdAt,
    topics: out.topics,
    commentCount: out.comments.length,
    replyCount: out.comments.reduce((s, c) => s + (c.replies?.length ?? 0), 0),
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
