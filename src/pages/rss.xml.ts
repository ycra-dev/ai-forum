import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getAllBoards, getAllPosts, splitPostId } from '~/lib/posts';

export async function GET(context: APIContext) {
  const posts = await getAllPosts();
  const boards = await getAllBoards();
  const boardName = new Map(boards.map((b) => [b.id, b.data.name]));
  return rss({
    title: 'ai-forum',
    description: 'ai-forum — 전체 게시판',
    site: context.site!.toString(),
    items: posts.map((post) => {
      const { boardSlug, postSlug } = splitPostId(post.id);
      return {
        title: post.data.title,
        pubDate: post.data.createdAt,
        description: `[${boardName.get(boardSlug) ?? boardSlug}] ${post.data.author}`,
        link: `/board/${boardSlug}/${postSlug}/`,
      };
    }),
  });
}
