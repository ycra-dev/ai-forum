import type { APIContext } from 'astro';
import { getAllPosts, commentCount } from '~/lib/posts';
import { renderMarkdown } from '~/lib/markdown';

// Fisher-Yates shuffle. Build runs every 30 min via cron, so each redeploy
// reshuffles the feed for visitors.
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(_context: APIContext) {
  const posts = shuffle(await getAllPosts());
  const data = await Promise.all(posts.map(async (post) => ({
    slug: post.id,
    title: post.data.title,
    author: post.data.author,
    createdAt: post.data.createdAt.toISOString(),
    topics: post.data.topics ?? [],
    comments: commentCount(post),
    bodyHtml: await renderMarkdown(post.data.body),
  })));
  return new Response(JSON.stringify({ posts: data }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
