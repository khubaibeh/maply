import type { Element } from "@maply/model/types";

import { createElementNameValidation, type ElementNameValidation } from "../elements/naming";
import type { DocumentChangeSet } from "./document-change";

/** Incremental name and asset projections maintained beside the indexed document. */
export type DerivedIndexes = {
	readonly apply: (change: DocumentChangeSet) => void;
	readonly nameCounts: () => ReadonlyMap<string, number>;
	readonly validations: () => ReadonlyMap<string, ElementNameValidation>;
	readonly referencedAssetIds: () => readonly string[];
};

function elementAssetId(element: Element | null): string | null {
	return element?.type === "image" && element.assetId ? element.assetId : null;
}

/** Creates incremental name-count, validation, and referenced-asset indexes. */
export function createDerivedIndexes(elements: readonly Element[] = []): DerivedIndexes {
	const names = new Map<string, string>();
	const nameCountsMap = new Map<string, number>();
	const nameMembers = new Map<string, Set<string>>();
	const validationsMap = new Map<string, ElementNameValidation>();
	const assetCounts = new Map<string, number>();
	const referencedAssets = new Set<string>();

	function addName(id: string, name: string) {
		const normalized = name.trim();
		names.set(id, name);
		nameCountsMap.set(normalized, (nameCountsMap.get(normalized) ?? 0) + 1);
		const members = nameMembers.get(normalized) ?? new Set<string>();
		members.add(id);
		nameMembers.set(normalized, members);
	}

	function removeName(id: string, name: string) {
		const normalized = name.trim();
		const count = nameCountsMap.get(normalized) ?? 0;
		if (count <= 1) nameCountsMap.delete(normalized);
		else nameCountsMap.set(normalized, count - 1);
		const members = nameMembers.get(normalized);
		members?.delete(id);
		if (members?.size === 0) nameMembers.delete(normalized);
		names.delete(id);
	}

	function addAsset(element: Element | null) {
		const assetId = elementAssetId(element);
		if (!assetId) return;
		const count = (assetCounts.get(assetId) ?? 0) + 1;
		assetCounts.set(assetId, count);
		referencedAssets.add(assetId);
	}

	function removeAsset(element: Element | null) {
		const assetId = elementAssetId(element);
		if (!assetId) return;
		const count = assetCounts.get(assetId) ?? 0;
		if (count <= 1) {
			assetCounts.delete(assetId);
			referencedAssets.delete(assetId);
		} else assetCounts.set(assetId, count - 1);
	}

	function refreshValidations(affectedNames: ReadonlySet<string>) {
		const usedNames = new Set(nameCountsMap.keys());
		const affectedIds = new Set<string>();
		for (const name of affectedNames) {
			for (const id of nameMembers.get(name) ?? []) affectedIds.add(id);
		}

		for (const id of affectedIds) {
			const name = names.get(id);
			if (name === undefined) {
				validationsMap.delete(id);
				continue;
			}
			validationsMap.set(id, createElementNameValidation({ id, name }, nameCountsMap, usedNames));
		}
	}

	for (const element of elements) {
		addName(element.id, element.name);
		addAsset(element);
	}
	refreshValidations(new Set(nameCountsMap.keys()));

	return {
		apply: (change) => {
			const affectedNames = new Set<string>();
			for (const entry of change.changes) {
				if (entry.before) {
					affectedNames.add(entry.before.name.trim());
					removeName(entry.id, entry.before.name);
					removeAsset(entry.before);
					if (!entry.after) validationsMap.delete(entry.id);
				}
				if (entry.after) {
					affectedNames.add(entry.after.name.trim());
					addName(entry.id, entry.after.name);
					addAsset(entry.after);
				}
			}
			refreshValidations(affectedNames);
		},
		nameCounts: () => nameCountsMap,
		validations: () => validationsMap,
		referencedAssetIds: () => [...referencedAssets]
	};
}
