import { Schema } from "effect";

export const ProjectFileOperationSchema = Schema.Literals(["create", "stringify", "parse", "import"]);
export const ProjectFileSectionSchema = Schema.Literals(["package", "project", "asset"]);

export type ProjectFileOperation = typeof ProjectFileOperationSchema.Type;
export type ProjectFileSection = typeof ProjectFileSectionSchema.Type;

export class ProjectFileJsonError extends Schema.TaggedErrorClass<ProjectFileJsonError>()("ProjectFileJsonError", {
	operation: ProjectFileOperationSchema,
	message: Schema.String,
	details: Schema.optionalKey(Schema.Unknown)
}) {}

export class UnsupportedProjectFileError extends Schema.TaggedErrorClass<UnsupportedProjectFileError>()(
	"UnsupportedProjectFileError",
	{
		operation: ProjectFileOperationSchema,
		field: Schema.Literals(["format", "version"]),
		expected: Schema.Unknown,
		actual: Schema.Unknown,
		message: Schema.String,
		details: Schema.optionalKey(Schema.Unknown)
	}
) {}

export class ProjectFileSchemaError extends Schema.TaggedErrorClass<ProjectFileSchemaError>()(
	"ProjectFileSchemaError",
	{
		operation: ProjectFileOperationSchema,
		section: ProjectFileSectionSchema,
		message: Schema.String,
		details: Schema.optionalKey(Schema.Unknown)
	}
) {}

export class ProjectFileAssetReferenceError extends Schema.TaggedErrorClass<ProjectFileAssetReferenceError>()(
	"ProjectFileAssetReferenceError",
	{
		operation: ProjectFileOperationSchema,
		reason: Schema.Literals(["duplicate", "missing"]),
		assetId: Schema.String,
		elementId: Schema.optionalKey(Schema.String),
		message: Schema.String,
		details: Schema.optionalKey(Schema.Unknown)
	}
) {}

export class ProjectFileSerializeError extends Schema.TaggedErrorClass<ProjectFileSerializeError>()(
	"ProjectFileSerializeError",
	{
		operation: ProjectFileOperationSchema,
		message: Schema.String,
		details: Schema.optionalKey(Schema.Unknown)
	}
) {}
