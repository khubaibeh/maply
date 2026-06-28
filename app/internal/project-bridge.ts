import { projectState } from "$lib/app/state/project.svelte";

import type { ProjectFilePackage } from "../types";

export function createProjectBridge(options?: { elements?: "sample" | "blank" }) {
	return projectState.createNewProject(options);
}

export function importProjectBridge(projectFile: ProjectFilePackage) {
	return projectState.importProjectFilePackage(projectFile);
}

export function exportProjectBridge() {
	return projectState.exportProjectFilePackage();
}

export function svgProjectBridge() {
	return projectState.exportSvg();
}
