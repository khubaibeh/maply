import { Effect } from "effect";

import { runApp } from "./runtime/browser-runtime";
import { ProjectRepo } from "./services/project-repo";

const DEFAULT_PROJECT_ID = "prod";

export type Teardown = () => void;

export function loadApp(projectId = DEFAULT_PROJECT_ID) {
	return Effect.gen(function* () {
		const repo = yield* ProjectRepo;
		return yield* repo.fetchProject(projectId);
	});
}

export function startAppLifecycle(): Teardown {
	/*
	 * Step 1 only establishes the lifecycle seam and initial load path.
	 * Reactive state wiring, autosave subscriptions, and unload flushing come
	 * later once the app-side state surfaces exist.
	 */
	void runApp(loadApp());

	return () => {};
}
