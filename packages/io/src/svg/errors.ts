import { Schema } from "effect";

export class SvgRenderError extends Schema.TaggedErrorClass<SvgRenderError>()("SvgRenderError", {
	message: Schema.String,
	details: Schema.optionalKey(Schema.Unknown)
}) {}

export class SvgRecoveryMetadataError extends Schema.TaggedErrorClass<SvgRecoveryMetadataError>()(
	"SvgRecoveryMetadataError",
	{
		message: Schema.String,
		details: Schema.optionalKey(Schema.Unknown)
	}
) {}

export class SvgRecoveryFormatError extends Schema.TaggedErrorClass<SvgRecoveryFormatError>()(
	"SvgRecoveryFormatError",
	{
		message: Schema.String,
		details: Schema.optionalKey(Schema.Unknown)
	}
) {}

export class SvgRecoveryAssetError extends Schema.TaggedErrorClass<SvgRecoveryAssetError>()("SvgRecoveryAssetError", {
	assetId: Schema.String,
	message: Schema.String,
	details: Schema.optionalKey(Schema.Unknown)
}) {}

export class SvgSynopticError extends Schema.TaggedErrorClass<SvgSynopticError>()("SvgSynopticError", {
	message: Schema.String,
	details: Schema.optionalKey(Schema.Unknown)
}) {}

export class SvgGenericError extends Schema.TaggedErrorClass<SvgGenericError>()("SvgGenericError", {
	message: Schema.String,
	details: Schema.optionalKey(Schema.Unknown)
}) {}

export class SvgParseError extends Schema.TaggedErrorClass<SvgParseError>()("SvgParseError", {
	message: Schema.String,
	details: Schema.optionalKey(Schema.Unknown)
}) {}

export class SvgEmptyDocumentError extends Schema.TaggedErrorClass<SvgEmptyDocumentError>()("SvgEmptyDocumentError", {
	message: Schema.String,
	details: Schema.optionalKey(Schema.Unknown)
}) {}

export class SvgImageDecodeError extends Schema.TaggedErrorClass<SvgImageDecodeError>()("SvgImageDecodeError", {
	message: Schema.String,
	details: Schema.optionalKey(Schema.Unknown)
}) {}
