import { appProjectState } from "../store/project";

const DEFAULT_PROJECT_ID = "prod";

export type Teardown = () => void;

export function loadApp(projectId = DEFAULT_PROJECT_ID) {
	/*
	 * Transitional bridge: live editable project hydration still lives in src/lib.
	 * Keep App.load() pointed at that path until app-owned state can apply the
	 * fetched record into the active UI stores behind the same public seam.
	 */
	return appProjectState.load(projectId);
}

export function startAppLifecycle(): Teardown {
	void loadApp();

	return () => {};
}
