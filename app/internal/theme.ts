import { getTheme, type Theme } from "../store/theme.svelte";

export { type Theme };

export const appTheme = {
	use() {
		return getTheme();
	},

	set(value: Theme) {
		getTheme().theme = value;
	}
} as const;
