import type { ImageAssetState } from "editor/types";
import { writable } from "svelte/store";

/** Image assets available to the live editor session. */
export const imageAssetState = writable<ImageAssetState>({});
