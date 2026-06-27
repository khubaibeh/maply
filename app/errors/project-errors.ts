import { Schema } from "effect";

export class ProjectExportError extends Schema.TaggedErrorClass<ProjectExportError>()("ProjectExportError", {
	message: Schema.String
}) {}
