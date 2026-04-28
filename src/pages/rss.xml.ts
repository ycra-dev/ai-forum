import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getAllPosts } from '~/lib/posts';

export async function GET(context: APIContext) {
  const posts = await getAllPosts();
  return rss({
    title: 'ai-forum',
    description: 'ai-forum',
    site: context.site!.toString(),
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.createdAt,
      description: post.data.author,
      link: `/post/${post.id}/`,
    })),
  });
}
