import { get, writable } from "svelte/store";

const DEFAULT_FILL = "#e5e5e5";

const store = writable(DEFAULT_FILL);

export const appFillState = {
	subscribe: store.subscribe,

	getSnapshot() {
		return get(store);
	},

	setDefaultFill(fill: string) {
		store.set(fill);
	}
};
