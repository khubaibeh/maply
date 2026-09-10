import type { Element } from "@maply/model/types";

/** Tags emitted by one atomic indexed-document mutation. */
export type DocumentChangeTag = "add" | "delete" | "update" | "reorder" | "replace";

/** Before and after values for one element touched by a document command. */
export type DocumentElementChange = {
	id: string;
	before: Element | null;
	after: Element | null;
};

/** Precise layer-order information for one document command. */
export type DocumentOrderChange =
	| { tag: "none" }
	| { tag: "insert"; ids: readonly string[]; index: number }
	| { tag: "remove"; ids: readonly string[]; indexes: readonly number[] }
	| { tag: "move"; ids: readonly string[]; fromIndexes: readonly number[]; toIndex: number }
	| { tag: "replace"; before: readonly string[]; after: readonly string[] };

/** The complete typed result of one indexed-document command. */
export type DocumentChangeSet = {
	tag: DocumentChangeTag;
	revision: number;
	changes: readonly DocumentElementChange[];
	order: DocumentOrderChange;
};

/** Callback notified once for each accepted document command. */
export type DocumentChangeListener = (change: DocumentChangeSet) => void;
