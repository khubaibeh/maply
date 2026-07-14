export type ToastKind = "error" | "success" | "info";

export type Toast = {
	id: string;
	kind: ToastKind;
	message: string;
};

const TOAST_DURATION = 4200;

function createToastState() {
	const toasts = $state<Toast[]>([]);

	function add(kind: ToastKind, message: string) {
		const id = crypto.randomUUID();
		toasts.push({ id, kind, message });
		return id;
	}

	function remove(id: string) {
		const index = toasts.findIndex((toast) => toast.id === id);
		if (index !== -1) toasts.splice(index, 1);
	}

	return {
		get toasts() {
			return toasts;
		},
		error: (message: string) => add("error", message),
		success: (message: string) => add("success", message),
		info: (message: string) => add("info", message),
		remove
	};
}

export const toast = createToastState();
export { TOAST_DURATION };
