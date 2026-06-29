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
import { appText } from "./internal/text";
import { appTheme } from "./internal/theme";
import { appValidate } from "./internal/validate";
import { runApp } from "./runtime/browser-runtime";
import { appState } from "./store/state";
import type { ProjectFilePackage } from "./types";

export const App = {
	start() {
		return startAppLifecycle();
	},

	load(projectId?: string) {
		// App.load hydrates the live app-owned stores that drive the UI.
		return loadApp(projectId);
	},

	// Project workflows stay grouped here so file import/export concerns remain separate from
	// the live editing actions exposed through App.actions.* and App.element.*.
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
