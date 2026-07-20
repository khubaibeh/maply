import { Layer, ManagedRuntime } from "effect";

const memoMap = Layer.makeMemoMapUnsafe();

export const IoLayer = Layer.empty;

export const ioRuntime = ManagedRuntime.make(IoLayer, { memoMap });
