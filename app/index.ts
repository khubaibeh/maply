import { appActions } from "./internal/actions";
import { deleteElement, pasteElement, replaceElementImage } from "./internal/element";
import { loadApp, startAppLifecycle } from "./internal/lifecycle";
import { createProject, exportProject, importProject, svgProject } from "./internal/project";
import { parseProjectFilePackage, stringifyProjectFilePackage } from "./internal/project-file";
import { flushProjectSave, queueProjectSave } from "./internal/save";
import { appState } from "./internal/state";
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

	element: {
		paste() {
			return runApp(pasteElement());
		},

		delete(id: string) {
			return runApp(deleteElement(id));
		},

		replaceImage(id: string, file: File) {
			return runApp(replaceElementImage(id, file));
		}
	},

	state: appState,

	actions: appActions,

	save: {
		queue() {
			return runApp(queueProjectSave());
		},

		flush() {
			return runApp(flushProjectSave());
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
