import { mergeConfig, defineConfig } from "vitest/config";

import baseConfig from "../vite.config";

export default mergeConfig(
	baseConfig,
	defineConfig({
		test: {
			include: ["benchmarks/**/*.test.ts"],
			exclude: ["tests/**/*.test.ts"]
		}
	})
);
