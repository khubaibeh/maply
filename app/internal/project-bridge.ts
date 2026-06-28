import { appProjectState } from "../store/project";
import type { ProjectFilePackage } from "../types";

export function createProjectBridge(options?: { elements?: "sample" | "blank" }) {
	return appProjectState.createNewProject(options);
}

export function importProjectBridge(projectFile: ProjectFilePackage) {
	return appProjectState.importProjectFilePackage(projectFile);
}

export function exportProjectBridge() {
	return appProjectState.exportProjectFilePackage();
}

export function svgProjectBridge() {
	return appProjectState.exportSvg();
}
