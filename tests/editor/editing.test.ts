import type { RectElement } from "@maply/model/types";
import { setColor } from "editor/canvas/commands";
import { updateElement } from "editor/elements/mutate";
import { projectState, updateProjectState } from "editor/state/document";
import { withAsyncEditorMutationEffect, withEditorMutationBlockEffect } from "editor/state/editing";
import { canvasState } from "editor/state/workspace";
import { Deferred, Effect, Result } from "effect";
import { get } from "svelte/store";
import { describe, expect, it } from "vitest";

function rect(): RectElement {
	return {
		id: "rect",
		name: "rect",
		type: "rect",
		locked: false,
		visible: true,
		bindable: true,
		x: 10,
		y: 10,
		width: 20,
		height: 20,
		fill: "#000",
		stroke: "#000",
		strokeWidth: 1
	};
}

describe("editor mutation block", () => {
	it("waits for admitted async mutations and rejects new ones", async () => {
		const admitted = Deferred.makeUnsafe<void>();
		const releaseMutation = Deferred.makeUnsafe<void>();
		const mutation = Effect.runPromise(
			withAsyncEditorMutationEffect(
				Effect.andThen(Deferred.succeed(admitted, undefined), Deferred.await(releaseMutation))
			)
		);
		await Effect.runPromise(Deferred.await(admitted));
		let operationStarted = false;
		const operation = Effect.runPromise(
			withEditorMutationBlockEffect(Effect.sync(() => (operationStarted = true)))
		);

		await Promise.resolve();
		expect(operationStarted).toBe(false);
		const rejected = await Effect.runPromise(Effect.result(withAsyncEditorMutationEffect(Effect.void)));
		expect(Result.isFailure(rejected) ? rejected.failure._tag : null).toBe("EditorBusy");

		await Effect.runPromise(Deferred.succeed(releaseMutation, undefined));
		await mutation;
		await operation;
		expect(operationStarted).toBe(true);
	});

	it("ignores document and canvas edits during a session operation", async () => {
		expect(updateProjectState((state) => ({ ...state, elements: [rect()] }), "rescan")).toBe(true);
		canvasState.set({ width: 100, height: 100, color: "#fff", x: 0, y: 0, camera: { x: 0, y: 0, zoom: 1 } });
		const started = Deferred.makeUnsafe<void>();
		const blocker = Deferred.makeUnsafe<void>();
		const blocked = Effect.runPromise(
			withEditorMutationBlockEffect(Effect.andThen(Deferred.succeed(started, undefined), Deferred.await(blocker)))
		);
		await Effect.runPromise(Deferred.await(started));

		expect(updateProjectState((state) => ({ ...state, name: "Blocked" }), "preserve")).toBe(false);
		expect(setColor("#123456")).toBe(false);
		updateElement("rect", { x: 40 });
		expect(get(projectState).elements[0]).toMatchObject({ x: 10 });
		expect(get(canvasState).color).toBe("#fff");

		await Effect.runPromise(Deferred.succeed(blocker, undefined));
		await blocked;
		updateElement("rect", { x: 40 });
		expect(setColor("#123456")).toBe(true);
		expect(get(projectState).elements[0]).toMatchObject({ x: 40 });
		expect(get(canvasState).color).toBe("#123456");
	});
});
