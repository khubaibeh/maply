import { imageFromSize } from "editor/elements/create";
import { describe, expect, it } from "vitest";

const canvas = { x: 10, y: 20, width: 800, height: 600, color: "#fff" };

describe("imageFromSize", () => {
	it("keeps natural dimensions when the image fits inside the canvas", () => {
		const image = imageFromSize(400, 200, canvas, []);

		expect(image).toMatchObject({ x: 210, y: 220, width: 400, height: 200 });
	});

	it("scales a wide image down uniformly to fit the canvas", () => {
		const image = imageFromSize(1600, 400, canvas, []);

		expect(image).toMatchObject({ x: 10, y: 220, width: 800, height: 200 });
	});

	it("scales a tall image down uniformly to fit the canvas", () => {
		const image = imageFromSize(400, 1200, canvas, []);

		expect(image).toMatchObject({ x: 310, y: 20, width: 200, height: 600 });
	});
});
