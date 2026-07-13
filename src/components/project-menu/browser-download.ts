/** Produces a filesystem-safe project download name with the requested extension. */
export function downloadName(name: string, extension: string) {
	const base = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return `${base || "maply-project"}.${extension}`;
}

/** Starts a browser text download and releases its object URL. */
export function downloadText(name: string, content: string, mimeType: string) {
	const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}
