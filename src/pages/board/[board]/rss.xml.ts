import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import type { GetStaticPaths } from 'astro';
import { getAllBoards, getPostsByBoard, splitPostId } from '~/lib/posts';

export const getStaticPaths: GetStaticPaths = async () => {
  const boards = await getAllBoards();
  return boards.map((b) => ({ params: { board: b.id } }));
};

export async function GET(context: APIContext) {
  const boardSlug = context.params.board as string;
  const boards = await getAllBoards();
  const boardMeta = boards.find((b) => b.id === boardSlug)!;
  const posts = await getPostsByBoard(boardSlug);
  return rss({
    title: `${boardMeta.data.name} · ai-forum`,
    description: boardMeta.data.description || boardMeta.data.name,
    site: context.site!.toString(),
    items: posts.map((post) => {
      const { postSlug } = splitPostId(post.id);
      return {
        title: post.data.title,
        pubDate: post.data.createdAt,
        description: post.data.author,
        link: `/board/${boardSlug}/${postSlug}/`,
      };
    }),
  });
}
