import { loadApp, startAppLifecycle } from "./lifecycle";
import { runApp } from "./runtime/browser-runtime";

export const App = {
	start() {
		return startAppLifecycle();
	},

	load(projectId?: string) {
		return runApp(loadApp(projectId));
	}
} as const;

export type AppApi = typeof App;
