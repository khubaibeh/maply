import { Schema } from "effect";

export const IndexedDbOperationSchema = Schema.Union([
	Schema.Literal("get"),
	Schema.Literal("put"),
	Schema.Literal("delete"),
	Schema.Literal("getMany"),
	Schema.Literal("deleteByIndex")
]);

export type IndexedDbOperation = typeof IndexedDbOperationSchema.Type;

export class IndexedDbOpenError extends Schema.TaggedErrorClass<IndexedDbOpenError>()("IndexedDbOpenError", {
	database: Schema.String,
	message: Schema.String
}) {}

export class IndexedDbStoreError extends Schema.TaggedErrorClass<IndexedDbStoreError>()("IndexedDbStoreError", {
	store: Schema.String,
	operation: IndexedDbOperationSchema,
	message: Schema.String
}) {}
