module.exports = {
	forbidden: [
		{
			name: "model-is-pure",
			severity: "error",
			from: { path: "^packages/model/" },
			to: {
				path: "^(src/|editor/|packages/(web|storage|codec)/)",
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
			to: { path: "^(src/|editor/|packages/web/)" }
		},
		{
			name: "io-no-ui-or-editor-imports",
			severity: "error",
			from: { path: "^packages/io/" },
			to: { path: "^(src/|editor/|packages/(web|storage)/)" }
		},
		{
			name: "editor-no-web-imports",
			severity: "error",
			from: { path: "^editor/" },
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
