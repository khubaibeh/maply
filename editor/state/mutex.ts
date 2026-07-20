type Release = () => void;

let pending: Promise<void> = Promise.resolve();

/** Serializes async editor mutations that read-then-persist state. */
export function acquireMutex(): Promise<Release> {
	let release!: Release;
	const next = new Promise<void>((resolve) => {
		release = resolve;
	});
	const wait = pending;
	pending = next;
	return wait.then(() => release);
}
