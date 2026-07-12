import type { ImportExportState } from "@maply/model/types";
import { writable } from "svelte/store";

export const importExportState = writable<ImportExportState>({ importsOpen: true, elementsOpen: true });
