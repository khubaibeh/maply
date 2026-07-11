import { Layer, ManagedRuntime } from "effect";

import { IndexedDb } from "../indexed-db/service";
import { ProjectRepository } from "../project/repository";

const memoMap = Layer.makeMemoMapUnsafe();
const indexedDbLayer = IndexedDb.layer;

export const StorageLayer = Layer.mergeAll(indexedDbLayer, ProjectRepository.layer.pipe(Layer.provide(indexedDbLayer)));

export const storageRuntime = ManagedRuntime.make(StorageLayer, { memoMap });
