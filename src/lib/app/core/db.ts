import { createDefaultProject } from "../domain/defaults";
import type { StoredImageAsset } from "../domain/image-assets";
import type { Project } from "../domain/project";

// TODO: Make a single function that returns an initialized object
// with all functions instead of relying on GLOBAL VARIABLES.
export const DEFAULTS = {
	name: "maply",
	version: 4,
	store: "projects",
	imageAssetStore: "image-assets",
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

async function readImageAssets(db: IDBDatabase, ids: string[]): Promise<StoredImageAsset[]> {
	return new Promise((resolve, reject) => {
		const txn = db.transaction(DEFAULTS.imageAssetStore, "readonly");
		const store = txn.objectStore(DEFAULTS.imageAssetStore);
		const assets = new Map<string, StoredImageAsset>();

		txn.oncomplete = () =>
			resolve(ids.map((id) => assets.get(id)).filter((asset): asset is StoredImageAsset => !!asset));
		txn.onerror = () => reject(txn.error);
		txn.onabort = () => reject(txn.error);

		for (const id of ids) {
			const request = store.get(id);
			request.onsuccess = () => {
				if (request.result) {
					assets.set(id, request.result as StoredImageAsset);
				}
			};
			request.onerror = () => reject(request.error);
		}
	});
}

async function putImageAssetRecord(db: IDBDatabase, asset: StoredImageAsset): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const txn = db.transaction(DEFAULTS.imageAssetStore, "readwrite");
		const store = txn.objectStore(DEFAULTS.imageAssetStore);

		txn.oncomplete = () => resolve();
		txn.onerror = () => reject(txn.error);
		txn.onabort = () => reject(txn.error);

		const request = store.put(structuredClone(asset));
		request.onerror = () => reject(request.error);
	});
}

async function deleteImageAssetRecord(db: IDBDatabase, id: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const txn = db.transaction(DEFAULTS.imageAssetStore, "readwrite");
		const store = txn.objectStore(DEFAULTS.imageAssetStore);

		txn.oncomplete = () => resolve();
		txn.onerror = () => reject(txn.error);
		txn.onabort = () => reject(txn.error);

		const request = store.delete(id);
		request.onerror = () => reject(request.error);
	});
}

async function deleteImageAssetsForProject(db: IDBDatabase, projectId: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const txn = db.transaction(DEFAULTS.imageAssetStore, "readwrite");
		const store = txn.objectStore(DEFAULTS.imageAssetStore);
		const index = store.index("projectId");
		const request = index.openCursor(IDBKeyRange.only(projectId));

		txn.oncomplete = () => resolve();
		txn.onerror = () => reject(txn.error);
		txn.onabort = () => reject(txn.error);

		request.onsuccess = () => {
			const cursor = request.result;
			if (!cursor) return;
			cursor.delete();
			cursor.continue();
		};
		request.onerror = () => reject(request.error);
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
			if (!db.objectStoreNames.contains(DEFAULTS.imageAssetStore)) {
				const imageStore = db.createObjectStore(DEFAULTS.imageAssetStore, { keyPath: "id" });
				imageStore.createIndex("projectId", "projectId", { unique: false });
			} else {
				const txn = req.transaction;
				const imageStore = txn?.objectStore(DEFAULTS.imageAssetStore);
				if (imageStore && !imageStore.indexNames.contains("projectId")) {
					imageStore.createIndex("projectId", "projectId", { unique: false });
				}
			}
		};
	});

	return dbPromise;
}

export async function fetchProject(id: string): Promise<Project> {
	const defaultId = DEFAULTS.projectId;
	const prodId = DEFAULTS.prodProjId;

	// indexedDB is undefined outside the browser
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

export async function fetchImageAssets(ids: string[]): Promise<StoredImageAsset[]> {
	if (typeof indexedDB === "undefined" || ids.length === 0) return [];

	const db = await openDB();
	return readImageAssets(db, ids);
}

export async function saveImageAsset(asset: StoredImageAsset): Promise<void> {
	if (typeof indexedDB === "undefined") return;

	const db = await openDB();
	await putImageAssetRecord(db, asset);
}

export async function deleteImageAsset(id: string): Promise<void> {
	if (typeof indexedDB === "undefined") return;

	const db = await openDB();
	await deleteImageAssetRecord(db, id);
}

export async function resetProdProject(options: { elements?: "sample" | "blank" } = {}): Promise<Project> {
	const prodId = DEFAULTS.prodProjId;

	if (typeof indexedDB === "undefined") {
		const fallback = createDefaultProject(prodId);
		return options.elements === "blank" ? { ...fallback, elements: [] } : fallback;
	}

	const db = await openDB();
	await deleteProjectRecord(db, prodId);
	await deleteImageAssetsForProject(db, prodId);

	const proj = createDefaultProject(prodId);
	if (options.elements === "blank") {
		proj.elements = [];
	}
	await putProject(db, proj);
	return proj;
}
