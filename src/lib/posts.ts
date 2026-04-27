import { getCollection, type CollectionEntry } from 'astro:content';

export type PostEntry = CollectionEntry<'posts'>;
export type BoardEntry = CollectionEntry<'boards'>;

// posts/<boardSlug>/<postSlug>.json -> { boardSlug, postSlug }
export function splitPostId(id: string): { boardSlug: string; postSlug: string } {
  const [boardSlug, ...rest] = id.split('/');
  return { boardSlug, postSlug: rest.join('/') };
}

export async function getAllBoards(): Promise<BoardEntry[]> {
  const boards = await getCollection('boards');
  return boards.sort((a, b) => (a.data.order - b.data.order) || a.id.localeCompare(b.id));
}

/** Groups boards by category. Category order is determined by the min `order`
 * of its boards (so the existing per-board order cascades up). */
export async function getBoardsByCategory(): Promise<Array<{ category: string; boards: BoardEntry[] }>> {
  const all = await getAllBoards();
  const groups = new Map<string, BoardEntry[]>();
  for (const b of all) {
    const arr = groups.get(b.data.category) ?? [];
    arr.push(b);
    groups.set(b.data.category, arr);
  }
  return Array.from(groups.entries())
    .map(([category, boards]) => ({ category, boards }))
    .sort((a, b) => Math.min(...a.boards.map((x) => x.data.order))
                  - Math.min(...b.boards.map((x) => x.data.order)));
}

export async function getAllPosts(): Promise<PostEntry[]> {
  const posts = await getCollection('posts');
  const now = Date.now();
  return posts
    .filter((p) => p.data.createdAt.getTime() <= now)
    .sort((a, b) => b.data.createdAt.getTime() - a.data.createdAt.getTime());
}

/** Drops future-dated comments and replies. Build runs periodically so
 * comments dated after build time stay hidden until the next build. */
export function filterPublishedComments<T extends { createdAt: Date; replies?: Array<{ createdAt: Date }> }>(
  comments: T[],
): T[] {
  const now = Date.now();
  return comments
    .filter((c) => c.createdAt.getTime() <= now)
    .map((c) => ({
      ...c,
      replies: (c.replies ?? []).filter((r) => r.createdAt.getTime() <= now),
    }));
}

export async function getPostsByBoard(boardSlug: string): Promise<PostEntry[]> {
  const all = await getAllPosts();
  return all.filter((p) => splitPostId(p.id).boardSlug === boardSlug);
}

export function commentCount(post: PostEntry): number {
  const top = filterPublishedComments(post.data.comments ?? []);
  let n = top.length;
  for (const c of top) n += (c.replies ?? []).length;
  return n;
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}
