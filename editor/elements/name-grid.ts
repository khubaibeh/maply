import { copyElementNameGrid, getElementNameGridIssue } from "@maply/model";
import type { ElementNameGrid } from "@maply/model/types";

import { updateProjectState } from "../state/document";

/** Replaces the project-owned element-name grid in live editor state. */
export function replaceElementNameGrid(elementNameGrid: ElementNameGrid): void {
	const issue = getElementNameGridIssue(elementNameGrid);
	if (issue) throw new RangeError(issue);
	updateProjectState(
		(state) => ({
			...state,
			elementNameGrid: copyElementNameGrid(elementNameGrid)
		}),
		"preserve"
	);
}

/** Sets whether the element-name import section is expanded. */
export function setElementNameImportOpen(isOpen: boolean): void {
	updateProjectState((state) => ({ ...state, isElementNameImportOpen: isOpen }), "preserve");
}
