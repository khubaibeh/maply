import { appActions } from "./internal/actions";
import { appCreate } from "./internal/create";
import { deleteElement, pasteElement, replaceElementImage } from "./internal/element";
import { appGeometry } from "./internal/geometry";
import { loadApp, startAppLifecycle } from "./internal/lifecycle";
import {
	createProjectBridge,
	exportProjectBridge,
	importProjectBridge,
	svgProjectBridge
} from "./internal/project-bridge";
import { parseProjectFilePackage, stringifyProjectFilePackage } from "./internal/project-file";
import { flushProjectSave, queueProjectSave } from "./internal/save";
import { appState } from "./internal/state";
import { appText } from "./internal/text";
import { appTheme } from "./internal/theme";
import { appValidate } from "./internal/validate";
import { runApp } from "./runtime/browser-runtime";
import type { ProjectFilePackage } from "./types";

export const App = {
	start() {
		return startAppLifecycle();
	},

	load(projectId?: string) {
		// Transitional bridge: load must hydrate the current live UI stores, not just fetch persistence.
		return loadApp(projectId);
	},

	// Transitional bridge: App.project.* is temporarily routed through the live src/lib state graph so
	// rewired UI consumers keep current behavior while that state still owns the editable document.
	// This is not moving away from Effect; it is a compatibility step until the app-owned project
	// implementation can take over the live state responsibilities behind the same public API.
	project: {
		create(options?: { elements?: "sample" | "blank" }) {
			return createProjectBridge(options);
		},

		import(projectFile: ProjectFilePackage) {
			return importProjectBridge(projectFile);
		},

		export() {
			return exportProjectBridge();
		},

		svg() {
			return svgProjectBridge();
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

	theme: appTheme,

	create: appCreate,

	geometry: appGeometry,

	text: appText,

	validate: appValidate,

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
