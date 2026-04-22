import { createHash } from 'node:crypto';
import { marked } from 'marked';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

function plantumlHash(src: string): string {
  return createHash('sha256').update(src).digest('hex').slice(0, 16);
}

// Swap ```plantuml blocks for an <img> pointing at the pre-rendered SVG
// (scripts/render-plantuml.mjs writes these to public/plantuml/<hash>.svg).
function preprocessPlantuml(md: string): string {
  return md.replace(/```plantuml\n([\s\S]*?)```/g, (_m, src) => {
    const id = plantumlHash(String(src).trim());
    return `<figure class="plantuml"><img src="${base}/plantuml/${id}.svg" alt="diagram" loading="lazy" /></figure>`;
  });
}

const renderer = new marked.Renderer();
marked.setOptions({ gfm: true, breaks: false });

export function renderMarkdown(md: string): string {
  const pre = preprocessPlantuml(md ?? '');
  return marked.parse(pre, { renderer, async: false }) as string;
}
