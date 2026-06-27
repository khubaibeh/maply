import { fileURLToPath } from "node:url";

import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const appPath = fileURLToPath(new URL("./app", import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@app": appPath
		}
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true)
			},
			adapter: adapter()
		})
	]
});
