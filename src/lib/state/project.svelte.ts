import { canvasState } from './canvas.svelte';
import { fetchProject, PROD_PROJECT_ID, saveProject } from '$lib/storage/project';
import type { Project } from '$lib/storage/schema';

function createProjectState() {
	let id = $state(PROD_PROJECT_ID);
	let name = $state('Untitled');
	let elements = $state<Project['elements']>([]);
	let importExportState = $state<Project['importExportState']>({
		importsOpen: true,
		elementsOpen: true
	});
	let initialized = $state(false);
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;

	function toProject(): Project {
		return {
			id,
			name,
			canvas: {
				width: canvasState.width,
				height: canvasState.height,
				x: canvasState.x,
				y: canvasState.y
			},
			camera: {
				x: canvasState.camera.x,
				y: canvasState.camera.y,
				zoom: canvasState.camera.zoom
			},
			elements: elements.map((element) => ({ ...element })),
			importExportState: { ...importExportState }
		};
	}

	function queueSave(project = toProject()) {
		if (!initialized) return;
		if (saveTimeout) clearTimeout(saveTimeout);

		saveTimeout = setTimeout(() => {
			saveProject(project).catch((error) => {
				console.warn('Failed to save project:', error);
			});
		}, 500);
	}

	async function load(projectId = PROD_PROJECT_ID) {
		id = projectId;

		try {
			const record = await fetchProject(id);
			name = record.name;
			elements = record.elements;
			importExportState = record.importExportState;
			canvasState.setSize(record.canvas.width, record.canvas.height);
			canvasState.setPosition(record.canvas.x, record.canvas.y);
			if (record.camera) {
				canvasState.setCamera(record.camera);
			}
		} catch (error) {
			console.warn('Failed to load project, using defaults:', error);
		}

		initialized = true;
	}

	function setName(nextName: string) {
		name = nextName;
		queueSave();
	}

	function setImportExportState(nextState: Partial<Project['importExportState']>) {
		const nextImportExportState = {
			...importExportState,
			...nextState
		};

		if (
			nextImportExportState.importsOpen === importExportState.importsOpen &&
			nextImportExportState.elementsOpen === importExportState.elementsOpen
		) {
			return;
		}

		importExportState = nextImportExportState;
		queueSave();
	}

	return {
		get id() {
			return id;
		},
		get name() {
			return name;
		},
		get initialized() {
			return initialized;
		},
		get importExportState() {
			return importExportState;
		},
		load,
		queueSave,
		setName,
		setImportExportState
	};
}

export const projectState = createProjectState();
export type { Project };
