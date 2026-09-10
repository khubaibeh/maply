<script lang="ts">
	import { benchmarkFixtureNames, createBenchmarkFixture, type BenchmarkFixtureName } from "$lib/benchmarks/fixtures";
	import { benchmarkScenarioNames, runBenchmarkSuite, type BenchmarkReport } from "$lib/benchmarks/runner";
	import { Button } from "$lib/components/ui/button";
	import CanvasArea from "@components/CanvasArea.svelte";
	import ElementsPanel from "@components/elements-panel/ElementsPanel.svelte";
	import { onMount } from "svelte";

	let benchmarkRoot = $state<HTMLElement>();
	let fixtureName = $state<BenchmarkFixtureName>("1k-simple");
	let report = $state<BenchmarkReport>();
	let error = $state<string>();
	let running = $state(false);
	let viewport = $state({ width: 1_200, height: 800 });

	const fixtureNames = benchmarkFixtureNames();

	onMount(() => {
		viewport = { width: window.innerWidth, height: window.innerHeight };
	});

	async function runBenchmarks() {
		if (!benchmarkRoot) return;
		running = true;
		error = undefined;
		report = undefined;

		try {
			const fixture = createBenchmarkFixture(fixtureName);
			report = await runBenchmarkSuite({
				fixture,
				root: benchmarkRoot,
				display: { viewport: { width: viewport.width, height: viewport.height }, zoom: fixture.zoom },
				repetitions: 3
			});
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
		} finally {
			running = false;
		}
	}
</script>

<svelte:head>
	<title>Maply | Benchmark Lab</title>
	<meta
		name="description"
		content="Measure Maply's editing, rendering, and persistence paths against deterministic fixtures."
	/>
</svelte:head>

<div bind:this={benchmarkRoot} class="benchmark-shell">
	<header class="benchmark-header">
		<div>
			<p class="benchmark-kicker">Maply / performance lab</p>
			<h1>50k element baseline</h1>
			<p class="benchmark-intro">
				The harness measures the indexed editor and hybrid renderer against a seeded fixture, keeping raw sample
				data in the report for comparison.
			</p>
		</div>
		<div class="benchmark-controls" aria-label="Benchmark controls">
			<label>
				<span>Fixture</span>
				<select bind:value={fixtureName} disabled={running}>
					{#each fixtureNames as name (name)}
						<option value={name}>{name}</option>
					{/each}
				</select>
			</label>
			<Button class="run-button" disabled={running} onclick={runBenchmarks}>
				{running ? "Running suite..." : "Run baseline"}
			</Button>
		</div>
	</header>

	<section class="benchmark-stage" aria-label="Live benchmark surface">
		<div class="benchmark-canvas">
			<CanvasArea />
		</div>
		<aside class="benchmark-sidebar" data-benchmark-sidebar>
			<ElementsPanel />
		</aside>
	</section>

	{#if error}
		<section class="benchmark-error" role="alert">
			<strong>Run stopped</strong>
			<span>{error}</span>
		</section>
	{/if}

	{#if report}
		<section class="benchmark-report" aria-live="polite">
			<div class="report-heading">
				<div>
					<p class="benchmark-kicker">Evidence captured</p>
					<h2>{report.fixture.name}</h2>
				</div>
				<p class="report-meta">
					{report.fixture.elementCount.toLocaleString()} elements · seed {report.fixture.seed} · {report
						.fixture.fingerprint}
				</p>
			</div>
			<div class="summary-table-wrap">
				<table>
					<thead>
						<tr>
							<th>Scenario</th>
							<th>Application median / p95</th>
							<th>Frame median / p95</th>
							<th>Long tasks</th>
						</tr>
					</thead>
					<tbody>
						{#each benchmarkScenarioNames() as scenario (scenario)}
							{@const summary = report.summaries[scenario]}
							<tr>
								<td>{scenario}</td>
								<td
									>{summary.applicationMs.median.toFixed(2)} / {summary.applicationMs.p95.toFixed(2)} ms</td
								>
								<td>{summary.frameMs.median.toFixed(2)} / {summary.frameMs.p95.toFixed(2)} ms</td>
								<td>{summary.longTaskMs.p95.toFixed(2)} ms</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<details>
				<summary>Raw report JSON</summary>
				<pre>{JSON.stringify(report, null, 2)}</pre>
			</details>
		</section>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		background: #11181d;
	}

	.benchmark-shell {
		--lab-ink: #e9f0ed;
		--lab-muted: #91a29c;
		--lab-line: #2d3a3d;
		--lab-panel: #182226;
		--lab-accent: #d7f171;
		min-height: 100vh;
		padding: clamp(1.25rem, 3vw, 3rem);
		color: var(--lab-ink);
		font-family: Inter, sans-serif;
	}

	.benchmark-header,
	.report-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		max-width: 90rem;
		margin-inline: auto;
	}

	.benchmark-kicker {
		margin: 0 0 0.65rem;
		color: var(--lab-accent);
		font-family: "Geist Mono", monospace;
		font-size: 0.72rem;
		letter-spacing: 0.08em;
	}

	h1,
	h2 {
		margin: 0;
		font-weight: 500;
		letter-spacing: -0.04em;
	}

	h1 {
		font-size: clamp(2rem, 5vw, 4.5rem);
		line-height: 0.95;
	}

	h2 {
		font-size: 2rem;
	}

	.benchmark-intro {
		max-width: 38rem;
		margin: 1rem 0 0;
		color: var(--lab-muted);
		line-height: 1.55;
	}

	.benchmark-controls {
		display: flex;
		align-items: end;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	label {
		display: grid;
		gap: 0.35rem;
		color: var(--lab-muted);
		font-family: "Geist Mono", monospace;
		font-size: 0.72rem;
	}

	select {
		min-width: 10.5rem;
		border: 1px solid var(--lab-line);
		border-radius: 0.35rem;
		background: var(--lab-panel);
		padding: 0.6rem 0.7rem;
		color: var(--lab-ink);
		font: inherit;
		font-size: 0.8rem;
	}

	:global(.run-button) {
		color: #142017;
		background: var(--lab-accent);
	}

	.benchmark-stage {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(15rem, 20rem);
		gap: 1rem;
		max-width: 90rem;
		min-height: 32rem;
		margin: 2.5rem auto 0;
	}

	.benchmark-canvas,
	.benchmark-sidebar {
		min-height: 32rem;
		overflow: hidden;
		border: 1px solid var(--lab-line);
		border-radius: 0.75rem;
		background: var(--lab-panel);
	}

	.benchmark-canvas :global(.canvas-viewport) {
		min-height: 32rem;
	}

	.benchmark-sidebar {
		display: flex;
	}

	.benchmark-error,
	.benchmark-report {
		max-width: 90rem;
		margin: 1rem auto 0;
		border: 1px solid var(--lab-line);
		border-radius: 0.75rem;
		background: var(--lab-panel);
	}

	.benchmark-error {
		display: flex;
		gap: 0.75rem;
		padding: 1rem;
		color: #ffb4a8;
	}

	.benchmark-report {
		padding: clamp(1rem, 2vw, 2rem);
	}

	.report-meta {
		margin: 0;
		color: var(--lab-muted);
		font-family: "Geist Mono", monospace;
		font-size: 0.72rem;
	}

	.summary-table-wrap {
		overflow-x: auto;
		margin-top: 1.5rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-family: "Geist Mono", monospace;
		font-size: 0.72rem;
		text-align: left;
	}

	th,
	td {
		border-bottom: 1px solid var(--lab-line);
		padding: 0.7rem 0.5rem;
		white-space: nowrap;
	}

	th {
		color: var(--lab-muted);
		font-weight: 400;
	}

	details {
		margin-top: 1.5rem;
		color: var(--lab-muted);
	}

	pre {
		max-height: 30rem;
		overflow: auto;
		border-top: 1px solid var(--lab-line);
		padding-top: 1rem;
		color: var(--lab-ink);
		font-size: 0.7rem;
		white-space: pre-wrap;
	}

	@media (max-width: 50rem) {
		.benchmark-header,
		.report-heading {
			align-items: start;
			flex-direction: column;
		}

		.benchmark-stage {
			grid-template-columns: 1fr;
		}

		.benchmark-sidebar {
			min-height: 20rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		* {
			scroll-behavior: auto !important;
			transition-duration: 0.01ms !important;
		}
	}
</style>
