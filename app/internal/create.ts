import { appFillState } from "../store/fill";
import {
	createCircleElementFromDrag,
	createImageElementFromDrag,
	createPathElementFromPoints,
	createRectElementFromDrag,
	createTextElementFromDrag
} from "./element-actions";

export const appCreate = {
	rectFromDrag(...[start, end, elements, options]: Parameters<typeof createRectElementFromDrag>) {
		return createRectElementFromDrag(start, end, elements, {
			...options,
			fill: appFillState.getSnapshot()
		});
	},

	circleFromDrag(...[start, end, elements]: Parameters<typeof createCircleElementFromDrag>) {
		return createCircleElementFromDrag(start, end, elements, appFillState.getSnapshot());
	},
	textFromDrag: createTextElementFromDrag,
	imageFromDrag: createImageElementFromDrag,
	pathFromPoints(...[points, closed, elements]: Parameters<typeof createPathElementFromPoints>) {
		return createPathElementFromPoints(points, closed, elements, appFillState.getSnapshot());
	}
} as const;
