import { getTextLayoutMetrics, getWrappedTextLineHeight, getWrappedTextLines, getWrappedTextMetrics } from "./element";

export const appText = {
	wrappedLines: getWrappedTextLines,
	wrappedLineHeight: getWrappedTextLineHeight,
	wrappedMetrics: getWrappedTextMetrics,
	layoutMetrics: getTextLayoutMetrics
} as const;
