let position = 0;
let pending = false;

export function rememberScroll(value: number) {
    if (!Number.isFinite(value) || value < 0) return;
    position = value;
}

export function requestScrollRestore() {
    pending = true;
}

export function applyScroll(node: HTMLElement | null): boolean {
    if (!node || !pending) return false;
    pending = false;
    node.scrollTop = position;
    return true;
}

export function resetScroll() {
    position = 0;
    pending = true;
}
