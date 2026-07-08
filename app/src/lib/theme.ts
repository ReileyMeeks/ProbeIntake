/**
 * Theme + shell-layout persistence with no-flash early paint.
 *
 * Default posture:
 *   • dark theme (per Liquid Glass spec)
 *   • vertical sidebar (per the floating-shell visual language)
 *
 * Both choices are stored in localStorage and applied to `<html>` via
 * data-* attributes BEFORE Svelte hydrates, so there's no flash of
 * wrong-theme or wrong-layout on first paint.
 */

export type Theme = 'dark' | 'light';
export type ShellLayout = 'vertical' | 'horizontal';
export type ListDensity = 'comfortable' | 'compact';
export type ListGrouping = 'none' | 'status';

const THEME_KEY = 'template-app:theme';
const LAYOUT_KEY = 'template-app:shellLayout';
const LIST_DENSITY_KEY = 'template-app:listDensity';
const LIST_GROUPING_KEY = 'template-app:listGrouping';

// ─── Theme ───────────────────────────────────────────────────────────

export function readTheme(): Theme {
	if (typeof localStorage === 'undefined') return 'dark';
	const stored = localStorage.getItem(THEME_KEY);
	if (stored === 'light' || stored === 'dark') return stored;
	if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches)
		return 'light';
	return 'dark';
}

export function writeTheme(theme: Theme): void {
	localStorage.setItem(THEME_KEY, theme);
	document.documentElement.setAttribute('data-theme', theme);
}

export function toggleTheme(): Theme {
	const next: Theme = readTheme() === 'dark' ? 'light' : 'dark';
	writeTheme(next);
	return next;
}

// ─── Shell layout ────────────────────────────────────────────────────

export function readShellLayout(): ShellLayout {
	if (typeof localStorage === 'undefined') return 'vertical';
	const stored = localStorage.getItem(LAYOUT_KEY);
	if (stored === 'vertical' || stored === 'horizontal') return stored;
	return 'vertical';
}

export function writeShellLayout(layout: ShellLayout): void {
	localStorage.setItem(LAYOUT_KEY, layout);
	document.documentElement.setAttribute('data-shell', layout);
}

export function toggleShellLayout(): ShellLayout {
	const next: ShellLayout = readShellLayout() === 'vertical' ? 'horizontal' : 'vertical';
	writeShellLayout(next);
	return next;
}

// ─── List view preferences ───────────────────────────────────────────

export function readListDensity(): ListDensity {
	if (typeof localStorage === 'undefined') return 'comfortable';
	const stored = localStorage.getItem(LIST_DENSITY_KEY);
	if (stored === 'comfortable' || stored === 'compact') return stored;
	return 'comfortable';
}

export function writeListDensity(value: ListDensity): void {
	localStorage.setItem(LIST_DENSITY_KEY, value);
}

export function readListGrouping(): ListGrouping {
	if (typeof localStorage === 'undefined') return 'none';
	const stored = localStorage.getItem(LIST_GROUPING_KEY);
	if (stored === 'none' || stored === 'status') return stored;
	return 'none';
}

export function writeListGrouping(value: ListGrouping): void {
	localStorage.setItem(LIST_GROUPING_KEY, value);
}

// ─── Hidden sources ─────────────────────────────────────────────────

const HIDDEN_SOURCES_KEY = 'template-app:hiddenSources';

export function readHiddenSources(): Set<string> {
	if (typeof localStorage === 'undefined') return new Set();
	try {
		const raw = localStorage.getItem(HIDDEN_SOURCES_KEY);
		if (!raw) return new Set();
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed))
			return new Set(parsed.filter((s): s is string => typeof s === 'string'));
	} catch {
		/* corrupted — treat as empty */
	}
	return new Set();
}

export function writeHiddenSources(slugs: Set<string>): void {
	localStorage.setItem(HIDDEN_SOURCES_KEY, JSON.stringify([...slugs]));
}

// ─── Early-paint script ──────────────────────────────────────────────

/**
 * Inline script content that runs before hydration. Reads both theme
 * and shell layout from localStorage and sets data-theme / data-shell
 * on <html> so the very first paint matches the user's last choices.
 */
export const earlyPaintScript = `
(function () {
  try {
    var theme = localStorage.getItem('${THEME_KEY}');
    if (theme !== 'light' && theme !== 'dark') {
      theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', theme);
    var shell = localStorage.getItem('${LAYOUT_KEY}');
    document.documentElement.setAttribute(
      'data-shell',
      (shell === 'horizontal' || shell === 'vertical') ? shell : 'vertical'
    );
  } catch (e) { /* localStorage blocked — fall through to defaults */ }
})();
`.trim();
