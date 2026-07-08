import { Effect } from "effect";

import { decodeProjectFilePackage, normalizePackage, schemaError, type ProjectFilePackage } from "./common";
import { PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION } from "./common";
import {
	ProjectFileAssetReferenceError,
	ProjectFileJsonError,
	ProjectFileSchemaError,
	UnsupportedProjectFileError
} from "./errors";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkSupport(parsed: unknown): Effect.Effect<void, UnsupportedProjectFileError | ProjectFileSchemaError> {
	if (!isRecord(parsed)) {
		return Effect.fail(
			new ProjectFileSchemaError({
				operation: "parse",
				section: "package",
				message: "Project file root must be an object.",
				details: { actual: parsed }
			})
		);
	}

	if ("format" in parsed && parsed.format !== PROJECT_FILE_FORMAT) {
		return Effect.fail(
			new UnsupportedProjectFileError({
				operation: "parse",
				field: "format",
				expected: PROJECT_FILE_FORMAT,
				actual: parsed.format,
				message: `Unsupported project file format: ${String(parsed.format)}.`
			})
		);
	}

	if ("version" in parsed && parsed.version !== PROJECT_FILE_VERSION) {
		return Effect.fail(
			new UnsupportedProjectFileError({
				operation: "parse",
				field: "version",
				expected: PROJECT_FILE_VERSION,
				actual: parsed.version,
				message: `Unsupported project file version: ${String(parsed.version)}.`
			})
		);
	}

	return Effect.void;
}

export function parse(
	text: string
): Effect.Effect<
	ProjectFilePackage,
	ProjectFileJsonError | UnsupportedProjectFileError | ProjectFileSchemaError | ProjectFileAssetReferenceError
> {
	return Effect.gen(function* () {
		const parsed = yield* Effect.try({
			try: () => JSON.parse(text) as unknown,
			catch: (error) =>
				new ProjectFileJsonError({
					operation: "parse",
					message: "Project file is not valid JSON.",
					details: { cause: error }
				})
		});

		yield* checkSupport(parsed);

		const projectFile = yield* decodeProjectFilePackage(parsed).pipe(
			Effect.mapError(schemaError("parse", "package"))
		);

		return yield* normalizePackage("parse", projectFile.project, projectFile.imageAssets);
	});
}

// Imported packages are rebound to the active project id before persistence.
export function assign(
	projectFile: ProjectFilePackage,
	projectId: string
): Effect.Effect<ProjectFilePackage, ProjectFileSchemaError | ProjectFileAssetReferenceError> {
	return Effect.gen(function* () {
		const normalized = yield* normalizePackage("import", projectFile.project, projectFile.imageAssets);

		return yield* normalizePackage(
			"import",
			{ ...normalized.project, id: projectId },
			normalized.imageAssets.map((asset) => ({ ...asset, projectId }))
		);
	});
}
