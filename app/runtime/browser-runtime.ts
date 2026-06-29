import { Effect, Layer, ManagedRuntime } from "effect";

import { IndexedDb } from "../services/indexed-db";
import { ProjectRepo } from "../services/project-repo";

const memoMap = Layer.makeMemoMapUnsafe();

const baseLayer = Layer.mergeAll(IndexedDb.layer);

export const AppLayer = Layer.mergeAll(baseLayer, ProjectRepo.layer.pipe(Layer.provide(baseLayer)));

export const appRuntime = ManagedRuntime.make(AppLayer, { memoMap });

export function runApp<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return appRuntime.runPromise(effect as Effect.Effect<A, E, never>);
}
