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
