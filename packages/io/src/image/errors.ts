import { Schema } from "effect";

export class ImageUnsupportedFormatError extends Schema.TaggedErrorClass<ImageUnsupportedFormatError>()(
	"ImageUnsupportedFormatError",
	{
		message: Schema.String,
		mimeType: Schema.String
	}
) {}

export class ImageReadError extends Schema.TaggedErrorClass<ImageReadError>()("ImageReadError", {
	message: Schema.String,
	details: Schema.optionalKey(Schema.Unknown)
}) {}

export class ImageInvalidSvgError extends Schema.TaggedErrorClass<ImageInvalidSvgError>()("ImageInvalidSvgError", {
	message: Schema.String
}) {}

export class ImageDimensionError extends Schema.TaggedErrorClass<ImageDimensionError>()("ImageDimensionError", {
	message: Schema.String,
	details: Schema.optionalKey(Schema.Unknown)
}) {}
