import {
	createCircleElementFromDrag,
	createImageElementFromDrag,
	createPathElementFromPoints,
	createRectElementFromDrag,
	createTextElementFromDrag
} from "./element";

export const appCreate = {
	rectFromDrag: createRectElementFromDrag,
	circleFromDrag: createCircleElementFromDrag,
	textFromDrag: createTextElementFromDrag,
	imageFromDrag: createImageElementFromDrag,
	pathFromPoints: createPathElementFromPoints
} as const;
