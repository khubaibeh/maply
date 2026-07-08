module.exports = {
	forbidden: [
		{
			name: "app-no-src-imports",
			severity: "error",
			from: { path: "^app/" },
			to: { path: "^src/" }
		},
		{
			name: "packages-no-root-app-imports",
			severity: "error",
			from: { path: "^packages/" },
			to: { path: "^app/" }
		},
		{
			name: "model-is-pure",
			severity: "error",
			from: { path: "^packages/model/" },
			to: {
				path: "^(src/|packages/(web|editor|storage|codec)/)",
				pathNot: "^packages/model/"
			}
		},
		{
			name: "model-no-framework-or-io-deps",
			severity: "error",
			from: { path: "^packages/model/" },
			to: {
				dependencyTypes: ["npm", "npm-dev"],
				path: "^(svelte|@sveltejs/|effect$|effect/)"
			}
		},
		{
			name: "storage-no-ui-imports",
			severity: "error",
			from: { path: "^packages/storage/" },
			to: { path: "^(src/|packages/(web|editor)/)" }
		},
		{
			name: "codec-no-ui-or-editor-imports",
			severity: "error",
			from: { path: "^packages/codec/" },
			to: { path: "^(src/|packages/(web|editor|storage)/)" }
		},
		{
			name: "editor-no-web-imports",
			severity: "error",
			from: { path: "^packages/editor/" },
			to: { path: "^(src/|packages/web/)" }
		}
	],
	options: {
		doNotFollow: { path: "node_modules" },
		exclude: { path: "^(build|.svelte-kit|node_modules|src/lib/components/ui)/" },
		tsPreCompilationDeps: true,
		enhancedResolveOptions: {
			conditionNames: ["import", "require", "node", "default"],
			extensions: [".ts", ".js", ".svelte"]
		}
	}
};
