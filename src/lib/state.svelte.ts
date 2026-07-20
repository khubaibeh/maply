export type Theme = "light" | "dark" | "system";

const storageKey = "maply-theme";

function getStoredTheme(): Theme {
	if (typeof localStorage === "undefined") return "system";

	const stored = localStorage.getItem(storageKey);
	return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function storeTheme(theme: Theme): void {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem(storageKey, theme);
}

function applyTheme(theme: Theme): void {
	if (typeof document === "undefined") return;

	const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const isDark = theme === "dark" || (theme === "system" && systemDark);
	document.documentElement.classList.toggle("dark", isDark);
}

function createTheme() {
	let theme = $state<Theme>(getStoredTheme());

	$effect(() => {
		applyTheme(theme);
		storeTheme(theme);
	});

	$effect(() => {
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = () => {
			if (theme === "system") applyTheme("system");
		};

		media.addEventListener("change", handler);
		return () => media.removeEventListener("change", handler);
	});

	return {
		get theme() {
			return theme;
		},
		set theme(value: Theme) {
			theme = value;
		}
	};
}

let instance: ReturnType<typeof createTheme> | null = null;

export function useTheme() {
	if (!instance) {
		instance = createTheme();
	}

	return instance;
}
