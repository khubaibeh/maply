import { createDefaultProject } from "$lib/editor/model/defaults";
import type { Project } from "$lib/editor/model/project";

const DB_NAME = "maply";
const DB_VERSION = 3;
const PROJECT_STORE = "projects";
const DEFAULT_PROJECT_ID = "default";
export const PROD_PROJECT_ID = "prod";

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
		camera: record.camera ? { ...defaultProject.camera, ...record.camera } : undefined,
		elements: record.elements ?? defaultProject.elements,
		importExportState: {
			...defaultProject.importExportState,
			...record.importExportState
		}
	};
}

async function readProject(db: IDBDatabase, id: string): Promise<Project | undefined> {
	return new Promise((resolve, reject) => {
		const txn = db.transaction(PROJECT_STORE, "readonly");
		const store = txn.objectStore(PROJECT_STORE);
		const req = store.get(id);

		req.onsuccess = () => resolve(req.result as Project | undefined);
		req.onerror = () => reject(req.error);
	});
}

async function putProject(db: IDBDatabase, project: Project): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const txn = db.transaction(PROJECT_STORE, "readwrite");
		const store = txn.objectStore(PROJECT_STORE);

		txn.oncomplete = () => resolve();
		txn.onerror = () => reject(txn.error);
		txn.onabort = () => reject(txn.error);

		const req = store.put(cloneProject(project));
		req.onerror = () => reject(req.error);
	});
}

async function deleteProjectRecord(db: IDBDatabase, id: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const txn = db.transaction(PROJECT_STORE, "readwrite");
		const store = txn.objectStore(PROJECT_STORE);

		txn.oncomplete = () => resolve();
		txn.onerror = () => reject(txn.error);
		txn.onabort = () => reject(txn.error);

		const request = store.delete(id);
		request.onerror = () => reject(request.error);
	});
}

function openDB() {
	if (dbPromise) return dbPromise;

	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);

		req.onerror = () => reject(req.error);
		req.onsuccess = () => resolve(req.result);

		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(PROJECT_STORE)) {
				db.createObjectStore(PROJECT_STORE, { keyPath: "id" });
			}
		};
	});

	return dbPromise;
}

export async function fetchProject(id: string): Promise<Project> {
	if (typeof indexedDB === "undefined")
		return createDefaultProject(id === DEFAULT_PROJECT_ID ? DEFAULT_PROJECT_ID : PROD_PROJECT_ID);

	const db = await openDB();
	const proj = createDefaultProject(DEFAULT_PROJECT_ID);
	await putProject(db, proj);

	const projectId = id === DEFAULT_PROJECT_ID ? DEFAULT_PROJECT_ID : PROD_PROJECT_ID;
	const record = await readProject(db, projectId);

	if (projectId === DEFAULT_PROJECT_ID) return proj;

	if (!record) {
		const prodProject = createDefaultProject(PROD_PROJECT_ID);
		await putProject(db, prodProject);
		return prodProject;
	}

	const defaults = createDefaultProject(PROD_PROJECT_ID);
	const merged = mergeProject(defaults, record);
	await putProject(db, merged);
	return merged;
}

export async function saveProject(project: Project): Promise<void> {
	if (typeof indexedDB === "undefined") return;
	if (project.id === DEFAULT_PROJECT_ID) return;

	const db = await openDB();
	await putProject(db, project);
}

export async function resetProdProject(): Promise<Project> {
	if (typeof indexedDB === "undefined") return createDefaultProject(PROD_PROJECT_ID);

	const db = await openDB();
	await deleteProjectRecord(db, PROD_PROJECT_ID);

	const proj = createDefaultProject(PROD_PROJECT_ID);
	await putProject(db, proj);
	return proj;
}
