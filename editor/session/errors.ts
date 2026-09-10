import { Schema } from "effect";

/** Storage operations coordinated by the editor session. */
export const PersistenceOperationSchema = Schema.Literals([
	"fetchProject",
	"fetchImageAssets",
	"saveProject",
	"saveImageAsset",
	"deleteImageAsset",
	"replaceProject",
	"resetProject"
]);

/** A storage operation coordinated by the editor session. */
export type PersistenceOperation = typeof PersistenceOperationSchema.Type;

/** The editor is busy with a session operation, so the mutation was rejected. */
export class EditorBusy extends Schema.TaggedErrorClass<EditorBusy>()("EditorBusy", {
	cause: Schema.optionalKey(Schema.Unknown)
}) {}

/** A newer project load superseded the current request. */
export class SessionSuperseded extends Schema.TaggedErrorClass<SessionSuperseded>()("SessionSuperseded", {}) {}

/** An editor storage write could not be committed. */
export class PersistenceFailed extends Schema.TaggedErrorClass<PersistenceFailed>()("PersistenceFailed", {
	operation: PersistenceOperationSchema,
	cause: Schema.Unknown
}) {}

/** An image element references an asset that is not available in the live session. */
export class ImageAssetMissing extends Schema.TaggedErrorClass<ImageAssetMissing>()("ImageAssetMissing", {
	assetId: Schema.String
}) {}

/** An image replacement targeted a missing or non-image element. */
export class ImageTargetInvalid extends Schema.TaggedErrorClass<ImageTargetInvalid>()("ImageTargetInvalid", {
	elementId: Schema.String
}) {}

/** A prepared image could not be attached to the editor project. */
export class ImageAttachmentFailed extends Schema.TaggedErrorClass<ImageAttachmentFailed>()("ImageAttachmentFailed", {
	cause: Schema.Unknown
}) {}
