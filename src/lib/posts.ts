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

export async function getAllPosts(): Promise<PostEntry[]> {
  const posts = await getCollection('posts');
  return posts.sort((a, b) => b.data.createdAt.getTime() - a.data.createdAt.getTime());
}

export async function getPostsByBoard(boardSlug: string): Promise<PostEntry[]> {
  const all = await getAllPosts();
  return all.filter((p) => splitPostId(p.id).boardSlug === boardSlug);
}

export function commentCount(post: PostEntry): number {
  const top = post.data.comments ?? [];
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
