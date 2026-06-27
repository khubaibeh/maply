import { loadApp, startAppLifecycle } from "./internal/lifecycle";
import { createProject, exportProject, svgProject } from "./internal/project";
import { runApp } from "./runtime/browser-runtime";

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

		export() {
			return runApp(exportProject());
		},

		svg() {
			return runApp(svgProject());
		}
	}
} as const;

export type AppApi = typeof App;
