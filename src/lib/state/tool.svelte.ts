export type Tool = "select" | "hand" | "rect" | "circle" | "path" | "text" | "image";

function createToolState() {
	let activeTool = $state<Tool>("select");
	let previousTool = $state<Tool | null>(null);
	let isSpacePressed = $state(false);

	function setTool(tool: Tool) {
		activeTool = tool;
	}

	function setSpacePressed(value: boolean) {
		if (value) {
			if (activeTool !== "hand") {
				previousTool = activeTool;
				activeTool = "hand";
			}
		} else if (previousTool !== null) {
			activeTool = previousTool;
			previousTool = null;
		}

		isSpacePressed = value;
	}

	return {
		get activeTool() {
			return activeTool;
		},
		set activeTool(value: Tool) {
			activeTool = value;
		},
		get isSpacePressed() {
			return isSpacePressed;
		},
		setTool,
		setSpacePressed
	};
}

export const toolState = createToolState();
