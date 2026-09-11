import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		include: ["tests/browser/**/*.test.ts"],
		browser: {
			enabled: true,
			provider: playwright(),
			instances: [{ browser: "chromium", headless: true }]
		}
	}
});
