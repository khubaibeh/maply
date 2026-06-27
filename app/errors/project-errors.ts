import { Schema } from "effect";

export class ProjectExportError extends Schema.TaggedErrorClass<ProjectExportError>()("ProjectExportError", {
	message: Schema.String
}) {}

export class ProjectSvgError extends Schema.TaggedErrorClass<ProjectSvgError>()("ProjectSvgError", {
	message: Schema.String
}) {}
