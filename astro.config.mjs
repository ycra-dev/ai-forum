import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://ycra-dev.github.io',
  base: '/ai-forum',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});
