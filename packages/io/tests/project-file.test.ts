import { project as projectIo } from "@maply/io";
import {
	project as projectEffect,
	ProjectFileAssetReferenceError,
	ProjectFileJsonError,
	ProjectFileSchemaError,
	ioRuntime,
	UnsupportedProjectFileError
} from "@maply/io/effect";
import { createProject } from "@maply/io/effect/program";
import { createDefaultProject, createProjectEditorData } from "@maply/model";
import type { Project, StoredImageAsset } from "@maply/model/types";
import { Cause, Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

function run<A, E>(effect: Effect.Effect<A, E>) {
	return Effect.runSync(effect);
}

function imageAsset(projectId: string): StoredImageAsset {
	return {
		id: "asset-1",
		projectId,
		name: "asset",
		mimeType: "image/png",
		dataUrl: "data:image/png;base64,",
		width: 1,
		height: 1
	};
}

function imageProject(): Project {
	return {
		...createDefaultProject("project-1"),
		elements: [
			{
				id: "image-1",
				name: "image",
				type: "image",
				x: 0,
				y: 0,
				width: 1,
				height: 1,
				assetId: "asset-1",
				cropX: 0,
				cropY: 0,
				cropScale: 100
			}
		]
	};
}

describe("project file IO", () => {
	it("creates project file packages", () => {
		const project = createDefaultProject("project-1");
		const file = run(projectEffect.file.create(project, []));

		expect(file.format).toBe("maply-project");
		expect(file.version).toBe(2);
		expect(file.project).toEqual(project);
		expect(file.project).not.toBe(project);
		expect(file.editorData).toEqual(createProjectEditorData());
	});

	it("stringifies and parses project file packages", () => {
		const editorData = {
			elementNameGrid: {
				headers: ["Name", "State"],
				rows: [
					["pump", "running"],
					["", ""]
				]
			}
		};
		const text = run(
			projectEffect.file.serialize(
				run(projectEffect.file.create(createDefaultProject("project-1"), [], editorData))
			)
		);
		const file = run(projectEffect.file.parse(text));

		expect(file.project.id).toBe("project-1");
		expect(file.imageAssets).toEqual([]);
		expect(file.editorData).toEqual(editorData);
	});

	it("migrates version 1 files to an empty element-name grid", () => {
		const file = run(
			projectEffect.file.parse(
				JSON.stringify({
					format: "maply-project",
					version: 1,
					project: createDefaultProject("legacy"),
					imageAssets: []
				})
			)
		);

		expect(file.version).toBe(2);
		expect(file.editorData).toEqual(createProjectEditorData());
	});

	it("runs IO effects through the default runtime", async () => {
		const file = await ioRuntime.runPromise(projectEffect.file.create(createDefaultProject("runtime"), []));

		expect(file.project.id).toBe("runtime");
	});

	it("exposes a default runtime-backed project API", async () => {
		const file = await projectIo.file.create(createDefaultProject("root"), []);
		expect(file.ok).toBe(true);
		if (!file.ok) return;

		const text = await projectIo.file.serialize(file.value);
		expect(text.ok).toBe(true);
		if (!text.ok) return;

		const parsed = await projectIo.file.parse(text.value);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;

		expect(parsed.value.project.id).toBe("root");
		expect(createProject).toBe(projectIo.file.create);
	});

	it("handles project API errors as values", async () => {
		const result = await projectIo.file.parse("not json");

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toBeInstanceOf(ProjectFileJsonError);
		expect(result.error.message).toBe("Project file is not valid JSON.");
	});

	it("rewrites imported project and asset ids", () => {
		const imported = run(
			projectEffect.file.assign(run(projectEffect.file.create(imageProject(), [imageAsset("project-1")])), "prod")
		);

		expect(imported.project.id).toBe("prod");
		expect(imported.imageAssets).toEqual([{ ...imageAsset("project-1"), projectId: "prod" }]);
	});

	it("rejects unsupported project file payloads", () => {
		expect(() => run(projectEffect.file.parse("not json"))).toThrow("Project file is not valid JSON.");
		expect(() => run(projectEffect.file.parse(JSON.stringify({ format: "other", version: 1 })))).toThrow(
			"Unsupported project file format: other."
		);
		expect(() => run(projectEffect.file.parse(JSON.stringify({ format: "maply-project", version: 3 })))).toThrow(
			"Unsupported project file version: 3."
		);
	});

	it("rejects image elements with missing asset data", () => {
		expect(() => run(projectEffect.file.create(imageProject(), []))).toThrow(
			"Project file is missing image asset data for assetId asset-1."
		);
	});

	it("returns detailed typed failures", () => {
		const exit = Effect.runSyncExit(projectEffect.file.parse("not json"));

		expect(Exit.isFailure(exit)).toBe(true);
		if (!Exit.isFailure(exit)) return;

		const reason = exit.cause.reasons.find(Cause.isFailReason);
		expect(reason?.error).toBeInstanceOf(ProjectFileJsonError);
		expect(reason?.error).toMatchObject({
			operation: "parse",
			message: "Project file is not valid JSON."
		});
		expect(reason?.error.details).toMatchObject({ cause: expect.any(SyntaxError) });
	});

	it("returns typed unsupported project file failures", () => {
		const exit = Effect.runSyncExit(
			projectEffect.file.parse(JSON.stringify({ format: "maply-project", version: 3 }))
		);

		expect(Exit.isFailure(exit)).toBe(true);
		if (!Exit.isFailure(exit)) return;

		const reason = exit.cause.reasons.find(Cause.isFailReason);
		expect(reason?.error).toBeInstanceOf(UnsupportedProjectFileError);
		expect(reason?.error).toMatchObject({
			operation: "parse",
			field: "version",
			expected: 2,
			actual: 3
		});
	});

	it("returns a typed error for non-object project file roots", () => {
		const exit = Effect.runSyncExit(projectEffect.file.parse("[]"));

		expect(Exit.isFailure(exit)).toBe(true);
		if (!Exit.isFailure(exit)) return;

		const reason = exit.cause.reasons.find(Cause.isFailReason);
		expect(reason?.error).toBeInstanceOf(ProjectFileSchemaError);
		expect(reason?.error).toMatchObject({
			operation: "parse",
			section: "package",
			message: "Project file root must be an object."
		});
	});

	it("returns typed asset reference failures", () => {
		const exit = Effect.runSyncExit(projectEffect.file.create(imageProject(), []));

		expect(Exit.isFailure(exit)).toBe(true);
		if (!Exit.isFailure(exit)) return;

		const reason = exit.cause.reasons.find(Cause.isFailReason);
		expect(reason?.error).toBeInstanceOf(ProjectFileAssetReferenceError);
		expect(reason?.error).toMatchObject({
			operation: "create",
			reason: "missing",
			assetId: "asset-1",
			elementId: "image-1"
		});
	});
});
