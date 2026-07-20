import type { ProjectFilePackage } from "../project/common";

export type SvgOptions = {
	embeddedFontCss?: string;
};

export enum SvgImportWarningType {
	InvalidPolygon = "InvalidPolygon",
	DroppedOutsideCanvas = "DroppedOutsideCanvas",
	DuplicateElementId = "DuplicateElementId",
	GenericFallback = "GenericFallback",
	SkippedIncompleteElement = "SkippedIncompleteElement",
	UnsupportedElement = "UnsupportedElement",
	IgnoredGroup = "IgnoredGroup",
	UnsupportedPathCommand = "UnsupportedPathCommand",
	IgnoredTransform = "IgnoredTransform",
	MalformedViewBox = "MalformedViewBox",
	StyleLoss = "StyleLoss",
	TextPositionLoss = "TextPositionLoss"
}

export type SvgImportWarning = {
	type: SvgImportWarningType;
	message: string;
	source?: {
		tag?: string;
		elementId?: string;
		attribute?: string;
	};
};

export type SvgImport = {
	file: ProjectFilePackage;
	source: "generic" | "recovery" | "synoptic";
	warnings: readonly SvgImportWarning[];
};
