import { Effect } from "effect";

import { isRecord } from "../common";
import {
	decodeProjectFilePackage,
	normalizePackage,
	PROJECT_FILE_FORMAT,
	PROJECT_FILE_VERSION,
	schemaError,
	type ProjectFilePackage
} from "./common";
import {
	ProjectFileAssetReferenceError,
	ProjectFileJsonError,
	ProjectFileSchemaError,
	UnsupportedProjectFileError
} from "./errors";

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
		// Decode JSON before inspecting format/version so malformed input gets a distinct error.
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

		// Schema decoding establishes the package shape before legacy normalization runs.
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

		// Rebinding requires normalization again because every asset must match the active project id.
		return yield* normalizePackage(
			"import",
			{ ...normalized.project, id: projectId },
			normalized.imageAssets.map((asset) => ({ ...asset, projectId }))
		);
	});
}
