import type { Element, Project, StoredImageAsset } from "@maply/model/types";

/** Fixture names used by the 50k-element benchmark plan. */
export type BenchmarkFixtureName = "1k-simple" | "10k-mixed" | "50k-typical" | "50k-all-visible" | "50k-selection";

/** Viewport settings that belong to a deterministic benchmark fixture. */
export type BenchmarkViewport = {
	width: number;
	height: number;
};

/** Selection sizes used by the selection benchmark fixture. */
export type BenchmarkSelections = {
	one: readonly string[];
	hundred: readonly string[];
	thousand: readonly string[];
	all: readonly string[];
};

/** A generated project and the bounded assets used by one benchmark run. */
export type BenchmarkFixture = {
	name: BenchmarkFixtureName;
	seed: number;
	viewport: BenchmarkViewport;
	zoom: number;
	project: Project;
	imageAssets: readonly StoredImageAsset[];
	selections: BenchmarkSelections;
	fingerprint: string;
};

/** The small, serializable part of a fixture used in evidence logs. */
export type BenchmarkFixtureManifest = {
	name: BenchmarkFixtureName;
	seed: number;
	elementCount: number;
	viewport: BenchmarkViewport;
	zoom: number;
	selectionCounts: {
		one: number;
		hundred: number;
		thousand: number;
		all: number;
	};
	fingerprint: string;
};

const fixtureSpecs: Record<BenchmarkFixtureName, { count: number; seed: number; canvas: BenchmarkViewport }> = {
	"1k-simple": { count: 1_000, seed: 0x1a2b3c4d, canvas: { width: 5_000, height: 3_000 } },
	"10k-mixed": { count: 10_000, seed: 0x2b3c4d5e, canvas: { width: 20_000, height: 12_000 } },
	"50k-typical": { count: 50_000, seed: 0x3c4d5e6f, canvas: { width: 120_000, height: 80_000 } },
	"50k-all-visible": { count: 50_000, seed: 0x4d5e6f70, canvas: { width: 1_200, height: 800 } },
	"50k-selection": { count: 50_000, seed: 0x5e6f7081, canvas: { width: 120_000, height: 80_000 } }
};

const benchmarkViewport = { width: 1_200, height: 800 } as const;
const imageDataUrl =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

type Random = () => number;
type ElementKind = "rect" | "circle" | "path" | "text" | "image";

function createRandom(seed: number): Random {
	let state = seed >>> 0;
	return () => {
		state = Math.imul(state ^ (state >>> 15), 1 | state);
		state = (state + Math.imul(state ^ (state >>> 7), 61 | state)) ^ state;
		return ((state ^ (state >>> 14)) >>> 0) / 4_294_967_296;
	};
}

function integer(random: Random, min: number, max: number): number {
	return Math.floor(random() * (max - min + 1)) + min;
}

function elementKind(name: BenchmarkFixtureName, index: number): ElementKind {
	const kinds: readonly ElementKind[] = ["rect", "circle", "path", "text", "image"];
	if (name === "1k-simple") return index % 2 === 0 ? "rect" : "circle";
	if (name === "50k-all-visible") {
		if (index % 100 === 0) return "path";
		if (index % 100 === 1) return "text";
		return index % 2 === 0 ? "rect" : "circle";
	}
	return kinds[index % kinds.length] ?? "rect";
}

function createElement(name: BenchmarkFixtureName, index: number, random: Random, canvas: BenchmarkViewport): Element {
	const kind = elementKind(name, index);
	const compact = name === "50k-all-visible";
	const width = compact ? integer(random, 4, 14) : integer(random, 40, 180);
	const height = compact ? integer(random, 4, 14) : integer(random, 30, 140);
	const frameWidth = kind === "text" ? Math.max(width, compact ? 20 : 100) : width;
	const frameHeight = kind === "text" ? Math.max(height, compact ? 12 : 28) : height;
	const x = integer(random, 0, Math.max(0, canvas.width - frameWidth));
	const y = integer(random, 0, Math.max(0, canvas.height - frameHeight));
	const id = `element-${index.toString(36)}`;
	const common = {
		id,
		name: `Element ${index + 1}`,
		locked: false,
		visible: true
	};

	switch (kind) {
		case "rect":
			return {
				...common,
				type: "rect",
				bindable: true,
				x,
				y,
				width,
				height,
				fill: index % 3 === 0 ? "#d7f171" : "#f2f4f7",
				stroke: "#25313c",
				strokeWidth: compact ? 0 : 1
			};
		case "circle":
			return {
				...common,
				type: "circle",
				bindable: true,
				cx: x + width / 2,
				cy: y + height / 2,
				r: Math.max(2, Math.min(width, height) / 2),
				fill: index % 3 === 0 ? "#9ee7d3" : "#e7edf2",
				stroke: "#25313c",
				strokeWidth: compact ? 0 : 1
			};
		case "path":
			return {
				...common,
				type: "path",
				bindable: true,
				x,
				y,
				d: `M0,0 L${width},0 L${width},${height} L0,${height}`,
				fill: "none",
				stroke: "#25313c",
				strokeWidth: compact ? 0.5 : 1,
				closed: true
			};
		case "text":
			return {
				...common,
				type: "text",
				bindable: false,
				x,
				y,
				width: frameWidth,
				height: frameHeight,
				text: `Label ${index + 1}`,
				fontSize: compact ? 6 : 16,
				fill: "#25313c"
			};
		case "image":
			return {
				...common,
				type: "image",
				bindable: false,
				x,
				y,
				width,
				height,
				assetId: `asset-${index % 8}`,
				cropX: 0,
				cropY: 0,
				cropScale: 100
			};
	}
}

function createImageAssets(projectId: string): StoredImageAsset[] {
	return Array.from({ length: 8 }, (_, index) => ({
		id: `asset-${index}`,
		projectId,
		name: `fixture-${index}.png`,
		mimeType: "image/png",
		dataUrl: imageDataUrl,
		width: 1,
		height: 1
	}));
}

function createSelections(elements: readonly Element[]): BenchmarkSelections {
	const ids = elements.map((element) => element.id);
	return {
		one: ids.slice(0, 1),
		hundred: ids.slice(0, 100),
		thousand: ids.slice(0, 1_000),
		all: ids
	};
}

function fingerprint(value: unknown): string {
	const text = JSON.stringify(value) ?? "";
	let hash = 2_166_136_261;
	for (let index = 0; index < text.length; index += 1) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 16_777_619);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Generates a deterministic benchmark fixture from its named seed. */
export function createBenchmarkFixture(name: BenchmarkFixtureName): BenchmarkFixture {
	const spec = fixtureSpecs[name];
	const random = createRandom(spec.seed);
	const elements = Array.from({ length: spec.count }, (_, index) => createElement(name, index, random, spec.canvas));
	const project: Project = {
		id: "prod",
		name: `Benchmark ${name}`,
		canvas: { ...spec.canvas, color: "#ffffff", x: 0, y: 0 },
		camera: { x: 0, y: 0, zoom: 1 },
		elements
	};
	const imageAssets = createImageAssets(project.id);
	const selections = createSelections(elements);

	return {
		name,
		seed: spec.seed,
		viewport: benchmarkViewport,
		zoom: 1,
		project,
		imageAssets,
		selections,
		fingerprint: fingerprint({ project, imageAssets, selections })
	};
}

/** Returns the fixture metadata used in benchmark evidence files. */
export function getBenchmarkFixtureManifest(fixture: BenchmarkFixture): BenchmarkFixtureManifest {
	return {
		name: fixture.name,
		seed: fixture.seed,
		elementCount: fixture.project.elements.length,
		viewport: fixture.viewport,
		zoom: fixture.zoom,
		selectionCounts: {
			one: fixture.selections.one.length,
			hundred: fixture.selections.hundred.length,
			thousand: fixture.selections.thousand.length,
			all: fixture.selections.all.length
		},
		fingerprint: fixture.fingerprint
	};
}

/** Lists fixture names in the order used by the improvement plan. */
export function benchmarkFixtureNames(): readonly BenchmarkFixtureName[] {
	return ["1k-simple", "10k-mixed", "50k-typical", "50k-all-visible", "50k-selection"];
}
