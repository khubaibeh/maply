import { loadApp, startAppLifecycle } from "./internal/lifecycle";
import { createProject, exportProject, importProject, svgProject } from "./internal/project";
import { parseProjectFilePackage, stringifyProjectFilePackage } from "./internal/project-file";
import { runApp } from "./runtime/browser-runtime";
import type { ProjectFilePackage } from "./types";

export const App = {
	start() {
		return startAppLifecycle();
	},

	load(projectId?: string) {
		return runApp(loadApp(projectId));
	},

	project: {
		create(options?: { elements?: "sample" | "blank" }) {
			return runApp(createProject(options));
		},

		import(projectFile: ProjectFilePackage) {
			return runApp(importProject(projectFile));
		},

		export() {
			return runApp(exportProject());
		},

		svg() {
			return runApp(svgProject());
		}
	},

	codec: {
		project: {
			parse(text: string) {
				return parseProjectFilePackage(text);
			},

			stringify(projectFile: ProjectFilePackage) {
				return stringifyProjectFilePackage(projectFile);
			}
		}
	}
} as const;

export type AppApi = typeof App;
