import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // SPA 모드를 위해 adapter-static 사용
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html', // SPA의 진입점이 될 파일
      precompress: false,
      strict: true
    })
  }
};

export default config;
