import { createHash } from 'node:crypto';
import { marked } from 'marked';
import { createHighlighter, type Highlighter } from 'shiki';
import tangoDark from './tango-dark.json';

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

let highlighterPromise: Promise<Highlighter> | null = null;
function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [tangoDark as any],
      langs: ['js', 'ts', 'tsx', 'jsx', 'json', 'bash', 'shell', 'python', 'java', 'go', 'rust', 'sql', 'yaml', 'toml', 'html', 'css', 'md', 'diff'],
    });
  }
  return highlighterPromise;
}

// Marked's sync API can't await Shiki, so we prime the highlighter once and
// swap code blocks after rendering via a post-pass.
const renderer = new marked.Renderer();
marked.setOptions({ gfm: true, breaks: false });

const CODE_PLACEHOLDER = /<pre><code(?: class="language-([^"]+)")?>([\s\S]*?)<\/code><\/pre>/g;

function htmlDecode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function highlight(html: string): Promise<string> {
  const hl = await getHighlighter();
  const loaded = hl.getLoadedLanguages();
  return html.replace(CODE_PLACEHOLDER, (_m, lang, code) => {
    const decoded = htmlDecode(code);
    const chosen = lang && loaded.includes(lang) ? lang : 'text';
    try {
      return hl.codeToHtml(decoded, { lang: chosen, theme: 'tango-dark' });
    } catch {
      return hl.codeToHtml(decoded, { lang: 'text', theme: 'tango-dark' });
    }
  });
}

export async function renderMarkdown(md: string): Promise<string> {
  const pre = preprocessPlantuml(md ?? '');
  const html = marked.parse(pre, { renderer, async: false }) as string;
  return await highlight(html);
}
