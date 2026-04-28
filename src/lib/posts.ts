import { getCollection, type CollectionEntry } from 'astro:content';

export type PostEntry = CollectionEntry<'posts'>;

export async function getAllPosts(): Promise<PostEntry[]> {
  const posts = await getCollection('posts');
  return posts.sort((a, b) => b.data.createdAt.getTime() - a.data.createdAt.getTime());
}

/** Returns each topic with the count of posts that use it, sorted by count desc. */
export async function getTopicCounts(): Promise<Array<{ topic: string; count: number }>> {
  const posts = await getAllPosts();
  const map = new Map<string, number>();
  for (const p of posts) {
    for (const t of p.data.topics ?? []) {
      map.set(t, (map.get(t) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}

/** Pass-through. Kept so call sites don't churn if we reintroduce filtering. */
export function filterPublishedComments<T>(comments: T[]): T[] {
  return comments;
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
