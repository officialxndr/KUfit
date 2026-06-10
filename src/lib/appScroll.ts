/**
 * Tiny registry so non-shell code (the feature tour) can scroll the AppShell's
 * main ScrollView, which it can't reach otherwise. `AppShell` registers its
 * scroller on mount; `scrollMainTo(y)` drives it.
 */
type Scroller = (y: number, animated?: boolean) => void;

let scroller: Scroller | null = null;

export function registerMainScroll(fn: Scroller | null): void {
  scroller = fn;
}

export function scrollMainTo(y: number, animated = true): void {
  scroller?.(y, animated);
}

// "Near the bottom" listeners so the active section can lazy-load more (infinite
// scroll) — the shell owns the ScrollView, so it fires this; sections subscribe.
type EndListener = () => void;
const endListeners = new Set<EndListener>();

/** Subscribe to "the main scroll is near its bottom"; returns an unsubscribe. */
export function onMainScrollNearEnd(fn: EndListener): () => void {
  endListeners.add(fn);
  return () => {
    endListeners.delete(fn);
  };
}

/** AppShell calls this from onScroll when the user nears the bottom. */
export function emitMainScrollNearEnd(): void {
  endListeners.forEach((fn) => fn());
}
