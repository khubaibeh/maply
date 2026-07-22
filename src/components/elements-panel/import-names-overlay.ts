import { writable } from "svelte/store";

/** Retains import-overlay visibility while the editor remounts after a viewport-size warning. */
export const importNamesOverlayOpen = writable(false);
