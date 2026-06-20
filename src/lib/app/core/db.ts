import { createDefaultProject } from "../domain/defaults";
import type { Project } from "../domain/project";

export const DEFAULTS = {
	name: "maply",
	version: 3,
	store: "projects",
	projectId: "default",
	prodProjId: "prod"
};

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
		const txn = db.transaction(DEFAULTS.store, "readonly");
		const store = txn.objectStore(DEFAULTS.store);
		const req = store.get(id);

		req.onsuccess = () => resolve(req.result as Project | undefined);
		req.onerror = () => reject(req.error);
	});
}

async function putProject(db: IDBDatabase, project: Project): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const txn = db.transaction(DEFAULTS.store, "readwrite");
		const store = txn.objectStore(DEFAULTS.store);

		txn.oncomplete = () => resolve();
		txn.onerror = () => reject(txn.error);
		txn.onabort = () => reject(txn.error);

		const req = store.put(cloneProject(project));
		req.onerror = () => reject(req.error);
	});
}

async function deleteProjectRecord(db: IDBDatabase, id: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const txn = db.transaction(DEFAULTS.store, "readwrite");
		const store = txn.objectStore(DEFAULTS.store);

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
		const req = indexedDB.open(DEFAULTS.name, DEFAULTS.version);

		req.onerror = () => reject(req.error);
		req.onsuccess = () => resolve(req.result);

		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(DEFAULTS.store)) {
				db.createObjectStore(DEFAULTS.store, { keyPath: "id" });
			}
		};
	});

	return dbPromise;
}

export async function fetchProject(id: string): Promise<Project> {
	const defaultId = DEFAULTS.projectId;
	const prodId = DEFAULTS.prodProjId;

	if (typeof indexedDB === "undefined") return createDefaultProject(id === defaultId ? defaultId : prodId);

	const db = await openDB();
	const proj = createDefaultProject(defaultId);
	await putProject(db, proj);

	const projectId = id === defaultId ? defaultId : prodId;
	const record = await readProject(db, projectId);

	if (projectId === defaultId) return proj;

	if (!record) {
		const prodProject = createDefaultProject(prodId);
		await putProject(db, prodProject);
		return prodProject;
	}

	const defaults = createDefaultProject(prodId);
	const merged = mergeProject(defaults, record);
	await putProject(db, merged);
	return merged;
}

export async function saveProject(project: Project): Promise<void> {
	if (typeof indexedDB === "undefined") return;
	if (project.id === DEFAULTS.projectId) return;

	const db = await openDB();
	await putProject(db, project);
}

export async function resetProdProject(): Promise<Project> {
	const prodId = DEFAULTS.prodProjId;

	if (typeof indexedDB === "undefined") return createDefaultProject(prodId);

	const db = await openDB();
	await deleteProjectRecord(db, prodId);

	const proj = createDefaultProject(prodId);
	await putProject(db, proj);
	return proj;
}
