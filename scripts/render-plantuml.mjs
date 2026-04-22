#!/usr/bin/env node
// Scan every post JSON for ```plantuml fenced blocks, render each via plantuml.jar,
// write SVGs into public/plantuml/<hash>.svg. Cached by content hash.
// The rendered SVG is referenced from the post body at runtime via the `plantuml`
// marker the markdown renderer emits (see src/lib/markdown.ts).

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const POSTS_DIR = join(ROOT, 'src/content/posts');
const OUT_DIR = join(ROOT, 'public/plantuml');
const JAR = process.env.PLANTUML_JAR || join(ROOT, 'plantuml.jar');

const FENCE = /```plantuml\n([\s\S]*?)```/g;

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && entry.name.endsWith('.json')) yield full;
  }
}

function hashOf(src) {
  return createHash('sha256').update(src).digest('hex').slice(0, 16);
}

function runJar(src) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('java', ['-Djava.awt.headless=true', '-jar', JAR, '-pipe', '-tsvg'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const chunks = [];
    const errs = [];
    child.stdout.on('data', (b) => chunks.push(b));
    child.stderr.on('data', (b) => errs.push(b));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`plantuml exited ${code}: ${Buffer.concat(errs).toString()}`));
      } else {
        resolvePromise(Buffer.concat(chunks));
      }
    });
    child.stdin.end(src);
  });
}

async function main() {
  if (!(await exists(POSTS_DIR))) {
    console.log('[plantuml] no posts dir, skipping');
    return;
  }
  if (!(await exists(JAR))) {
    console.warn(`[plantuml] ${JAR} not found — install via GitHub Actions or manually for local dev.`);
    console.warn('[plantuml] skipping PlantUML rendering (blocks will show as code)');
    return;
  }
  await mkdir(OUT_DIR, { recursive: true });

  const blocks = [];
  for await (const file of walk(POSTS_DIR)) {
    const raw = await readFile(file, 'utf8');
    let data;
    try { data = JSON.parse(raw); } catch { continue; }
    const body = typeof data.body === 'string' ? data.body : '';
    for (const m of body.matchAll(FENCE)) {
      blocks.push({ file, src: m[1].trim() });
    }
  }

  console.log(`[plantuml] found ${blocks.length} block(s)`);
  let rendered = 0, cached = 0;
  for (const { file, src } of blocks) {
    const id = hashOf(src);
    const out = join(OUT_DIR, `${id}.svg`);
    if (await exists(out)) { cached++; continue; }
    try {
      const svg = await runJar(src);
      await writeFile(out, svg);
      rendered++;
    } catch (e) {
      console.error(`[plantuml] failed (${file}): ${e.message}`);
      process.exitCode = 1;
    }
  }
  console.log(`[plantuml] rendered=${rendered} cached=${cached}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
