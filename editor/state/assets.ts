import { writable } from "svelte/store";

import type { ImageAssetState } from "../types";

/** Image assets available to the live editor session. */
export const imageAssetState = writable<ImageAssetState>({});
