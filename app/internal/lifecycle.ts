import { appProjectState } from "../store/project";

const DEFAULT_PROJECT_ID = "prod";

export type Teardown = () => void;

export function loadApp(projectId = DEFAULT_PROJECT_ID) {
	// Load routes through the live project store so the active UI state is hydrated in one place.
	return appProjectState.load(projectId);
}

export function startAppLifecycle(): Teardown {
	void loadApp();

	return () => {};
}
