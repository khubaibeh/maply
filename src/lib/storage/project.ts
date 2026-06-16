import { createDefaultProject } from './default-settings';
import type { Project } from './schema';

const DB_NAME = 'maply';
const DB_VERSION = 3;
const PROJECT_STORE = 'projects';
const DEFAULT_PROJECT_ID = 'default';
export const PROD_PROJECT_ID = 'prod';

let dbPromise: Promise<IDBDatabase> | null = null;

function cloneProject(project: Project): Project {
	return structuredClone(project);
}

function mergeProject(defaultProject: Project, record: Project): Project {
	return {
		...defaultProject,
		...record,
		canvas: {
			...defaultProject.canvas,
			...record.canvas
		},
		camera: record.camera ? { ...record.camera } : defaultProject.camera,
		elements: record.elements ?? defaultProject.elements,
		importExportState: {
			...defaultProject.importExportState,
			...record.importExportState
		}
	};
}

async function readProject(db: IDBDatabase, id: string): Promise<Project | undefined> {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(PROJECT_STORE, 'readonly');
		const store = transaction.objectStore(PROJECT_STORE);
		const request = store.get(id);

		request.onsuccess = () => resolve(request.result as Project | undefined);
		request.onerror = () => reject(request.error);
	});
}

async function putProject(db: IDBDatabase, project: Project): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const transaction = db.transaction(PROJECT_STORE, 'readwrite');
		const store = transaction.objectStore(PROJECT_STORE);

		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
		transaction.onabort = () => reject(transaction.error);

		const request = store.put(cloneProject(project));
		request.onerror = () => reject(request.error);
	});
}

function openDB() {
	if (dbPromise) return dbPromise;

	dbPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(PROJECT_STORE)) {
				db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
			}
		};
	});

	return dbPromise;
}

export async function fetchProject(id: string): Promise<Project> {
	if (typeof indexedDB === 'undefined')
		return createDefaultProject(id === DEFAULT_PROJECT_ID ? DEFAULT_PROJECT_ID : PROD_PROJECT_ID);

	const db = await openDB();
	const defaultProject = createDefaultProject(DEFAULT_PROJECT_ID);
	await putProject(db, defaultProject);

	const projectId = id === DEFAULT_PROJECT_ID ? DEFAULT_PROJECT_ID : PROD_PROJECT_ID;
	const record = await readProject(db, projectId);

	if (projectId === DEFAULT_PROJECT_ID) return defaultProject;

	if (!record) {
		const prodProject = createDefaultProject(PROD_PROJECT_ID);
		await putProject(db, prodProject);
		return prodProject;
	}

	const prodDefaults = createDefaultProject(PROD_PROJECT_ID);
	const mergedProject = mergeProject(prodDefaults, record);
	await putProject(db, mergedProject);
	return mergedProject;
}

export async function saveProject(project: Project): Promise<void> {
	if (typeof indexedDB === 'undefined') return;
	if (project.id === DEFAULT_PROJECT_ID) return;

	const db = await openDB();
	await putProject(db, project);
}
