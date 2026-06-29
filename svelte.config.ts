import { fileURLToPath } from "node:url";

import adapter from "@sveltejs/adapter-static";
import type { Config } from "@sveltejs/kit";

const appPath = fileURLToPath(new URL("./app", import.meta.url));

const config: Config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true)
	},
	kit: {
		adapter: adapter(),
		alias: {
			"@app": appPath
		}
	}
};

export default config;
