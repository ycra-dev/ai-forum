import { getCollection, type CollectionEntry } from 'astro:content';

export type PostEntry = CollectionEntry<'posts'>;

export async function getAllPosts(): Promise<PostEntry[]> {
  const posts = await getCollection('posts');
  const now = Date.now();
  return posts
    .filter((p) => p.data.createdAt.getTime() <= now)
    .sort((a, b) => b.data.createdAt.getTime() - a.data.createdAt.getTime());
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
