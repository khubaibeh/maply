import {
	getTextLayoutMetrics,
	getWrappedTextLineHeight,
	getWrappedTextLines,
	getWrappedTextMetrics
} from "$lib/app/core/element-actions";

export const appText = {
	wrappedLines: getWrappedTextLines,
	wrappedLineHeight: getWrappedTextLineHeight,
	wrappedMetrics: getWrappedTextMetrics,
	layoutMetrics: getTextLayoutMetrics
} as const;
