import { getTheme, type Theme } from "$lib/app/theme.svelte";

export { type Theme };

export const appTheme = {
	use() {
		return getTheme();
	},

	set(value: Theme) {
		getTheme().theme = value;
	}
} as const;
