#!/usr/bin/env node
// Decide author / commenters / topics / timestamp deterministically (no LLM).
// Reads personas.json, optionally takes --topic="..." or --author="..." overrides.
// Emits a JSON plan on stdout that the orchestrator (Claude) feeds into sub-agents.

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(__dir, '..');
const REPO_ROOT = resolve(SKILL_DIR, '../../..');

function parseArgs(argv) {
  const out = { subject: '', topic: '', author: '', dryRun: false };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--subject=')) out.subject = a.slice('--subject='.length);
    else if (a.startsWith('--topic=')) out.topic = a.slice('--topic='.length);
    else if (a.startsWith('--author=')) out.author = a.slice('--author='.length);
    else if (a === '--dry-run') out.dryRun = true;
  }
  return out;
}

function weightedPick(items, weightFn) {
  const total = items.reduce((s, x) => s + weightFn(x), 0);
  let r = Math.random() * total;
  for (const x of items) {
    r -= weightFn(x);
    if (r <= 0) return x;
  }
  return items[items.length - 1];
}

function pickN(arr, n) {
  const a = arr.slice();
  const out = [];
  while (out.length < n && a.length) {
    const i = Math.floor(Math.random() * a.length);
    out.push(a.splice(i, 1)[0]);
  }
  return out;
}

function kstIso(date) {
  // Always emit "+09:00" form. Build runs in UTC; we just shift display.
  const ms = date.getTime() + 9 * 60 * 60 * 1000;
  const d = new Date(ms);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T`
       + `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+09:00`;
}

function slugFromIso(iso) {
  // 2026-04-29T10:30:00+09:00 -> 2026-04-29T10-30-00
  return iso.slice(0, 19).replace(/:/g, '-');
}

async function main() {
  const args = parseArgs(process.argv);
  const personasPath = join(SKILL_DIR, 'personas.json');
  const personas = JSON.parse(await readFile(personasPath, 'utf8')).personas;

  // 1. author
  let author;
  if (args.author) {
    author = personas.find((p) => p.name === args.author);
    if (!author) {
      console.error(`unknown author: ${args.author}`);
      process.exit(1);
    }
  } else {
    author = weightedPick(personas, (p) => p.activity ?? 1);
  }

  // 2. topics — explicit `--topic=` overrides; otherwise pick from author's preferences.
  // Topics are tags used for filtering; the writing direction comes from `subject`.
  const topics = [];
  if (args.topic) {
    args.topic.split(',').forEach((t) => {
      const v = t.trim();
      if (v) topics.push(v);
    });
  } else {
    const pool = author.topics ?? [];
    const n = 1 + Math.floor(Math.random() * 2);
    pickN(pool, Math.min(n, pool.length)).forEach((t) => topics.push(t));
  }
  const subject = args.subject || null;

  // 3. createdAt — always now. Feed order is randomized at build time anyway,
  // so faking future timestamps adds no value.
  const now = Date.now();
  const offsetMs = 0;
  const createdAt = kstIso(new Date(now + offsetMs));
  const slug = slugFromIso(createdAt);

  // 4. commenters — 0..3 distinct, exclude author
  const others = personas.filter((p) => p.name !== author.name);
  const nComments = Math.floor(Math.random() * 4); // 0..3
  const commenters = [];
  const commenterPool = others.slice();
  for (let i = 0; i < nComments && commenterPool.length; i++) {
    const c = weightedPick(commenterPool, (p) => p.activity ?? 1);
    commenters.push(c);
    commenterPool.splice(commenterPool.indexOf(c), 1);
  }

  // 5. replies — each comment 30% chance of 1 reply by someone else
  const replies = commenters.map((c) => {
    if (Math.random() >= 0.3) return null;
    const repliers = personas.filter((p) => p.name !== c.name);
    if (!repliers.length) return null;
    return weightedPick(repliers, (p) => p.activity ?? 1).name;
  });

  // 6. comment timestamps: each within (5min..24h) of post; reply within (5min..12h) of comment
  function commentTime(baseMs, maxHours) {
    const off = (5 / 60 + Math.random() * (maxHours - 5 / 60)) * 60 * 60 * 1000;
    return new Date(baseMs + off);
  }
  const postTimeMs = new Date(createdAt.replace('+09:00', 'Z')).getTime() - 9 * 3600 * 1000;
  // Actually rebuild from now+offset to keep consistent:
  const postBaseMs = now + offsetMs;
  let lastCommentMs = postBaseMs;
  const commentTimes = commenters.map(() => {
    lastCommentMs = commentTime(lastCommentMs, 24).getTime();
    return kstIso(new Date(lastCommentMs));
  });
  const replyTimes = replies.map((r, i) => {
    if (!r) return null;
    return kstIso(commentTime(new Date(commentTimes[i].replace('+09:00', 'Z')).getTime() - 9 * 3600 * 1000, 12));
  });

  // 7. find a slug that doesn't collide
  let finalSlug = slug;
  try {
    const existing = new Set(
      (await readdir(join(REPO_ROOT, 'src/content/posts'))).map((f) => f.replace(/\.json$/, ''))
    );
    let suffix = 1;
    while (existing.has(finalSlug)) finalSlug = `${slug}-${suffix++}`;
  } catch {}

  const plan = {
    author,
    subject,
    topics,
    createdAt,
    slug: finalSlug,
    filePath: `src/content/posts/${finalSlug}.json`,
    commenters: commenters.map((c, i) => ({
      persona: c,
      createdAt: commentTimes[i],
      replyAuthor: replies[i] ? personas.find((p) => p.name === replies[i]) : null,
      replyCreatedAt: replyTimes[i],
    })),
  };

  if (args.dryRun) {
    console.error('--- plan summary (stderr) ---');
    console.error(`author: ${plan.author.name}`);
    console.error(`subject: ${plan.subject ?? '(auto)'}`);
    console.error(`topics: ${plan.topics.join(', ')}`);
    console.error(`createdAt: ${plan.createdAt}`);
    console.error(`commenters: ${plan.commenters.map((c) => c.persona.name + (c.replyAuthor ? `→${c.replyAuthor.name}` : '')).join(', ') || '(none)'}`);
  }
  console.log(JSON.stringify(plan, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
