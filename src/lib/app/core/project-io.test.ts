import { describe, expect, it } from "vitest";

import { createDefaultProject } from "../domain/defaults";
import type { StoredImageAsset } from "../domain/image-assets";
import {
	PROJECT_FILE_FORMAT,
	PROJECT_FILE_VERSION,
	createProjectFilePackage,
	parseProjectFilePackage,
	stringifyProjectFilePackage,
	toImportedProject
} from "./project-io";

function createAsset(id: string, projectId = "prod"): StoredImageAsset {
	return {
		id,
		projectId,
		name: `${id}.png`,
		mimeType: "image/png",
		dataUrl: "data:image/png;base64,abc",
		width: 200,
		height: 100
	};
}

describe("project file package", () => {
	it("round-trips a valid project package", () => {
		const project = createDefaultProject("prod");
		project.elements = [
			{
				id: "image-1",
				name: "Photo",
				type: "image",
				x: 10,
				y: 20,
				width: 120,
				height: 90,
				assetId: "asset-1",
				cropX: 0,
				cropY: 0,
				cropScale: 100
			}
		];

		const projectFile = createProjectFilePackage(project, [createAsset("asset-1")]);
		const parsed = parseProjectFilePackage(stringifyProjectFilePackage(projectFile));

		expect(parsed.format).toBe(PROJECT_FILE_FORMAT);
		expect(parsed.version).toBe(PROJECT_FILE_VERSION);
		expect(parsed.project.elements).toHaveLength(1);
		expect(parsed.imageAssets[0]?.id).toBe("asset-1");
	});

	it("rejects unsupported versions", () => {
		expect(() =>
			parseProjectFilePackage(
				JSON.stringify({
					format: PROJECT_FILE_FORMAT,
					version: 99,
					project: createDefaultProject("prod"),
					imageAssets: []
				})
			)
		).toThrow(/Unsupported project file version/i);
	});

	it("rejects unsupported formats", () => {
		expect(() =>
			parseProjectFilePackage(
				JSON.stringify({
					format: "not-maply-project",
					version: PROJECT_FILE_VERSION,
					project: createDefaultProject("prod"),
					imageAssets: []
				})
			)
		).toThrow(/Unsupported project file format/i);
	});

	it("rejects malformed payloads", () => {
		expect(() => parseProjectFilePackage("{not json")).toThrow(/not valid json/i);
		expect(() =>
			parseProjectFilePackage(
				JSON.stringify({
					format: PROJECT_FILE_FORMAT,
					version: PROJECT_FILE_VERSION,
					project: { id: "prod" },
					imageAssets: []
				})
			)
		).toThrow(/Project elements must be an array/i);
	});

	it("rejects missing referenced asset data", () => {
		const project = createDefaultProject("prod");
		project.elements = [
			{
				id: "image-1",
				name: "Photo",
				type: "image",
				x: 10,
				y: 20,
				width: 120,
				height: 90,
				assetId: "asset-1",
				cropX: 0,
				cropY: 0,
				cropScale: 100
			}
		];

		expect(() => createProjectFilePackage(project, [])).toThrow(/missing image asset data/i);
	});

	it("rejects duplicate asset ids in imported payloads", () => {
		const project = createDefaultProject("prod");
		project.elements = [
			{
				id: "image-1",
				name: "Photo",
				type: "image",
				x: 10,
				y: 20,
				width: 120,
				height: 90,
				assetId: "asset-1",
				cropX: 0,
				cropY: 0,
				cropScale: 100
			}
		];

		expect(() =>
			parseProjectFilePackage(
				JSON.stringify({
					format: PROJECT_FILE_FORMAT,
					version: PROJECT_FILE_VERSION,
					project,
					imageAssets: [createAsset("asset-1"), createAsset("asset-1")]
				})
			)
		).toThrow(/Duplicate image asset id/i);
	});

	it("rewrites imported project ownership for the active slot", () => {
		const project = createDefaultProject("some-other-id");
		project.elements = [
			{
				id: "image-1",
				name: "Photo",
				type: "image",
				x: 10,
				y: 20,
				width: 120,
				height: 90,
				assetId: "asset-1",
				cropX: 0,
				cropY: 0,
				cropScale: 100
			}
		];

		const imported = toImportedProject(
			createProjectFilePackage(project, [createAsset("asset-1", "other")]),
			"prod"
		);

		expect(imported.project.id).toBe("prod");
		expect(imported.imageAssets[0]?.projectId).toBe("prod");
	});

	it("accepts proxied project file objects during import normalization", () => {
		const project = createDefaultProject("some-other-id");
		project.elements = [
			{
				id: "image-1",
				name: "Photo",
				type: "image",
				x: 10,
				y: 20,
				width: 120,
				height: 90,
				assetId: "asset-1",
				cropX: 0,
				cropY: 0,
				cropScale: 100
			}
		];

		const projectFile = createProjectFilePackage(project, [createAsset("asset-1", "other")]);
		const proxiedProjectFile = new Proxy(projectFile, {});

		expect(() => toImportedProject(proxiedProjectFile, "prod")).not.toThrow();
	});
});
