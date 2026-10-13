import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
process.env.PUBLIC_APP_VERSION = pkg.version;

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: true,
		fs: {
			// 루트의 설정 파일을 읽기 위해 반드시 필요합니다.
			allow: ['.']
		},
		watch: {
			ignored: ['**/Download/**', '**/android/**', '**/build/**']
		}
	},
	optimizeDeps: {
		exclude: ['jeep-sqlite']
	}
});
