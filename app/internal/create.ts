import {
	createCircleElementFromDrag,
	createImageElementFromDrag,
	createPathElementFromPoints,
	createRectElementFromDrag,
	createTextElementFromDrag
} from "$lib/app/core/element-actions";

export const appCreate = {
	rectFromDrag: createRectElementFromDrag,
	circleFromDrag: createCircleElementFromDrag,
	textFromDrag: createTextElementFromDrag,
	imageFromDrag: createImageElementFromDrag,
	pathFromPoints: createPathElementFromPoints
} as const;
