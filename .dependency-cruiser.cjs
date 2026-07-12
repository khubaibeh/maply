module.exports = {
	forbidden: [
		{
			name: "model-is-pure",
			severity: "error",
			from: { path: "^packages/model/" },
			to: {
				path: "^(src/|editor/|packages/(web|storage|io)/)",
				pathNot: "^packages/model/"
			}
		},
		{
			name: "no-private-model-entrypoints",
			severity: "error",
			from: { path: "^(src/|editor/|packages/(io|storage)/)" },
			to: { path: "^packages/model/src/(?!index\\.ts$|types\\.ts$|effect\\.ts$)" }
		},
		{
			name: "no-private-io-entrypoints",
			severity: "error",
			from: { path: "^(src/|editor/|packages/storage/)" },
			to: { path: "^packages/io/src/(?!index\\.ts$|types\\.ts$|effect/(index|program)\\.ts$)" }
		},
		{
			name: "no-private-storage-entrypoints",
			severity: "error",
			from: { path: "^(src/|editor/|packages/io/)" },
			to: { path: "^packages/storage/src/(?!index\\.ts$|types\\.ts$|effect/index\\.ts$)" }
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
