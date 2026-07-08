<script lang="ts">
  import './layout.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import GlassFilter from '$lib/glass/GlassFilter.svelte';
  import GlassToolbar from '$lib/glass/GlassToolbar.svelte';
  import GlassButton from '$lib/glass/GlassButton.svelte';
  import { BrandMark, SidebarToggleIcon } from '$lib/icons';
  import SupportTicketButton from '$lib/domain/SupportTicketButton.svelte';
  import {
    earlyPaintScript,
    readTheme,
    toggleTheme,
    readShellLayout,
    toggleShellLayout,
    type Theme,
    type ShellLayout
  } from '$lib/theme';
  import { auth, initAuth, login, logout, isAuthConfigured, attemptAutoLogin } from '$lib/auth/auth0.svelte';
  import { supportsBackdropSvgFilter } from '$lib/glass/featureDetect';
  import { loadMe, meStore } from '$lib/domain/me.svelte';
  import { canManageUsers, canSeeAllAnalyses } from '$lib/domain/roles';

  let { children } = $props();

  let theme = $state<Theme>('dark');
  let shell = $state<ShellLayout>('vertical');
  let chromeRefract = $state(false);

  onMount(() => {
    theme = readTheme();
    shell = readShellLayout();
    chromeRefract = supportsBackdropSvgFilter();
    if (!page.url.pathname.startsWith('/share/')) {
      initAuth();
    }
  });

  const isPublicPage = $derived(
    page.url.pathname === '/' ||
    page.url.pathname.startsWith('/share/') ||
    page.url.pathname === '/auth/callback'
  );

  $effect(() => {
    const path = page.url.pathname;
    const search = page.url.search;
    const fullPath = search ? `${path}${search}` : path;
    /*
    if (isAuthConfigured() && !auth.state.loading && !auth.state.isAuthenticated && !isPublicPage) {
      attemptAutoLogin(fullPath).then((attempted) => {
        if (!attempted) {
          goto(`/?next=${encodeURIComponent(fullPath)}`);
        }
      });
    }
    */
  });

  $effect(() => {
    if (auth.state.isAuthenticated) {
      loadMe();
    }
  });

  // SF Symbol-equivalent SVGs (Phosphor Icons, MIT license — square.grid.2x2.fill,
  // gearshape.fill, info.circle.fill equivalents)
  const NAV_ICONS: Record<string, string> = {
    dashboard: `<svg width="15" height="15" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48v48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48v48Z"/></svg>`,
    settings: `<svg width="15" height="15" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M237.9,150.6l-14.9-18.7q.1-2.16,0-4.32l14.9-18.6a8,8,0,0,0,1.5-7.1,108.6,108.6,0,0,0-10.9-26.2,8,8,0,0,0-6-3.9L198.1,69.2q-1.5-1.56-3-3L192.5,42.3a8,8,0,0,0-3.9-6A107.3,107.3,0,0,0,162.3,25.4a8,8,0,0,0-7.1,1.5L136.6,41.8q-2.16-.06-4.32,0L113.7,26.9a8,8,0,0,0-7.1-1.5A107.6,107.6,0,0,0,80.4,36.3a8,8,0,0,0-3.9,6L73.8,66.1q-1.56,1.49-3,3L47.2,71.7a8,8,0,0,0-6,3.9,107.7,107.7,0,0,0-10.9,26.2,8,8,0,0,0,1.5,7.1l14.9,18.6q-.06,2.16,0,4.32L31.8,150.4a8,8,0,0,0-1.5,7.1,107.2,107.2,0,0,0,10.9,26.2,8,8,0,0,0,6,3.9l23.7,2.6q1.49,1.56,3,3l2.6,23.7a8,8,0,0,0,3.9,6,107.7,107.7,0,0,0,26.2,10.9,8,8,0,0,0,7.1-1.5l18.6-14.9q2.16.06,4.32,0l18.6,14.9a8,8,0,0,0,7.1,1.5,107.2,107.2,0,0,0,26.2-10.9,8,8,0,0,0,3.9-6l2.6-23.7q1.56-1.48,3-3l23.7-2.6a8,8,0,0,0,6-3.9,107.7,107.7,0,0,0,10.9-26.2A8,8,0,0,0,237.9,150.6ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z"/></svg>`,
    info: `<svg width="15" height="15" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M128,24A104,104,0,1,0,232,128,104.1,104.1,0,0,0,128,24Zm-4,48a12,12,0,1,1,12,12A12,12,0,0,1,124,72Zm12,112a16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40a8,8,0,0,1,0,16Z"/></svg>`
  };

  const navItems = $derived.by(() => {
    return [
      { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { href: '/settings', label: 'Settings', icon: 'settings' },
      { href: '/about', label: 'About', icon: 'info' }
    ];
  });

  function isActive(href: string): boolean {
    return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
  }

  function onToggleTheme() {
    theme = toggleTheme();
  }

  function onToggleShell() {
    shell = toggleShellLayout();
  }

  const SUN = '☀︎';
  const MOON = '☾︎';

  let mobileMenuOpen = $state(false);

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }
</script>

<svelte:head>
  {@html `<script>${earlyPaintScript}</script>`}
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <title>Template App</title>
</svelte:head>

<GlassFilter />

{#if isPublicPage}
  {@render children()}
{:else}

<!-- Mobile hamburger pill -->
<button
  type="button"
  class="mobile-hamburger glass glass-press focus-glass" class:menu-open={mobileMenuOpen}
  onclick={toggleMobileMenu}
  aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
  aria-expanded={mobileMenuOpen}
>
  <span class="hamburger-ring">
    <span class="hamburger-icon" class:hamburger-open={mobileMenuOpen}>
      <span></span>
      <span></span>
      <span></span>
    </span>
  </span>
  {#if !mobileMenuOpen}
    <span class="hamburger-brand" aria-hidden="true"><BrandMark size="1.25rem" /></span>
  {/if}
</button>

<!-- Mobile sidebar overlay -->
{#if mobileMenuOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div class="mobile-scrim" onclick={closeMobileMenu}></div>
  <aside
    class="mobile-sidebar glass {chromeRefract ? 'glass-refract-subtle' : ''}"
    aria-label="Primary navigation"
  >
    <a href="/" class="brand brand-stack brand-link focus-glass" onclick={closeMobileMenu} aria-label="Template App — home">
      <span class="brand-mark" aria-hidden="true"><BrandMark size="1.75rem" /></span>
      <span class="brand-text">
        <span class="brand-primary">Template App</span>
      </span>
    </a>

    <nav class="nav-group" aria-label="Primary">
      {#each navItems as item (item.href)}
        <a
          href={item.href}
          aria-current={isActive(item.href) ? 'page' : undefined}
          class="nav-item"
          onclick={closeMobileMenu}
        >
          {@html NAV_ICONS[item.icon] ?? ''}
          {item.label}
        </a>
      {/each}
    </nav>

    <div class="sidebar-footer">
      <GlassButton
        size="sm"
        onclick={onToggleTheme}
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        class="footer-action"
      >
        <span aria-hidden="true">{theme === 'dark' ? SUN : MOON}</span>
        <span class="sr-only">Toggle theme</span>
      </GlassButton>
    </div>

    {#if auth.state.isAuthenticated && auth.state.user}
      <div class="user-chip" title={auth.state.user.email ?? ''}>
        <span class="user-name">{auth.state.user.name ?? auth.state.user.email ?? 'Signed in'}</span>
        <button type="button" class="signout-link focus-glass" onclick={() => logout()}>
          Sign out
        </button>
      </div>
    {:else if !auth.state.loading}
      <GlassButton size="sm" tone="primary" onclick={() => login()} class="footer-action">
        Sign in
      </GlassButton>
    {/if}
  </aside>
{/if}

<div class="app-shell" data-shell={shell}>
  {#if shell === 'vertical'}
    <aside
      class="sidebar glass {chromeRefract ? 'glass-refract-subtle' : ''}"
      aria-label="Primary navigation"
    >
      <a href="/analyses" class="brand brand-stack brand-link focus-glass" aria-label="Template App — home">
        <span class="brand-mark" aria-hidden="true"><BrandMark size="1.75rem" /></span>
        <span class="brand-text">
          <span class="brand-primary">Template App</span>
        </span>
      </a>

      <nav class="nav-group" aria-label="Primary">
        {#each navItems as item (item.href)}
          <a
            href={item.href}
            aria-current={isActive(item.href) ? 'page' : undefined}
            class="nav-item"
          >
            {@html NAV_ICONS[item.icon] ?? ''}
            {item.label}
          </a>
        {/each}
      </nav>

      <div class="sidebar-footer">
        <GlassButton
          size="sm"
          onclick={onToggleShell}
          title="Hide sidebar"
          class="footer-action"
        >
          <SidebarToggleIcon state="shown" />
          <span class="sr-only">Hide sidebar</span>
        </GlassButton>
        <GlassButton
          size="sm"
          onclick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          class="footer-action"
        >
          <span aria-hidden="true">{theme === 'dark' ? SUN : MOON}</span>
          <span class="sr-only">Toggle theme</span>
        </GlassButton>
      </div>

      <SupportTicketButton />

      {#if auth.state.isAuthenticated && auth.state.user}
        <div class="user-chip" title={auth.state.user.email ?? ''}>
          <span class="user-name">{auth.state.user.name ?? auth.state.user.email ?? 'Signed in'}</span>
          <button type="button" class="signout-link focus-glass" onclick={() => logout()}>
            Sign out
          </button>
        </div>
      {:else if !auth.state.loading}
        <GlassButton size="sm" tone="primary" onclick={() => login()} class="footer-action">
          Sign in
        </GlassButton>
      {/if}
    </aside>

    <main class="content">
      {@render children()}
    </main>
  {:else}
    <div class="main">
      <GlassToolbar>
        <div class="toolbar-left">
          <GlassButton
            size="sm"
            onclick={onToggleShell}
            title="Show sidebar"
            class="toolbar-action toolbar-pill"
          >
            <SidebarToggleIcon state="hidden" />
            <span class="sr-only">Show sidebar</span>
          </GlassButton>
          <a
            href="/"
            class="brand inline-brand brand-stack brand-link focus-glass"
            aria-label="Template App — home"
          >
            <span class="brand-mark" aria-hidden="true"><BrandMark size="1.75rem" /></span>
            <span class="brand-text">
              <span class="brand-primary">Template App</span>
            </span>
          </a>
          <nav class="nav-group nav-group-row" aria-label="Primary">
            {#each navItems as item (item.href)}
              <a
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                class="nav-item"
              >
                {@html NAV_ICONS[item.icon] ?? ''}
                {item.label}
              </a>
            {/each}
          </nav>
        </div>
        <div class="toolbar-right">
          <GlassButton
            size="sm"
            onclick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <span aria-hidden="true">{theme === 'dark' ? SUN : MOON}</span>
            <span class="sr-only">Toggle theme</span>
          </GlassButton>
          <SupportTicketButton />
          {#if auth.state.isAuthenticated}
            <GlassButton size="sm" onclick={() => logout()}>Sign out</GlassButton>
          {/if}
        </div>
      </GlassToolbar>

      <main class="content">
        {@render children()}
      </main>
    </div>
  {/if}
</div>
{/if}

<style>
  .app-shell {
    --toolbar-reserve: 3.75rem;
    display: grid;
    gap: 1rem;
    min-height: 100vh;
    align-items: start;
    transition: grid-template-columns 480ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .app-shell[data-shell='vertical'] {
    grid-template-columns: 240px 1fr;
  }
  .app-shell[data-shell='horizontal'] {
    grid-template-columns: 1fr;
  }
  .app-shell[data-shell='vertical'] > .content {
    padding-top: var(--toolbar-reserve);
  }

  /* ─── Sidebar ──────────────────────────────────────────── */
  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem 0.875rem;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    animation: spring-from-left 520ms cubic-bezier(0.34, 1.56, 0.64, 1);
    transform-origin: top left;
    will-change: transform;
    border-radius: 0;
  }
  @keyframes spring-from-left {
    0% { transform: translateX(-32px) scale(0.92); opacity: 0; }
    60% { transform: translateX(4px) scale(1.02); opacity: 1; }
    100% { transform: translateX(0) scale(1); opacity: 1; }
  }
  .app-shell[data-shell='horizontal'] > .main {
    animation: spring-from-top 520ms cubic-bezier(0.34, 1.56, 0.64, 1);
    transform-origin: top center;
    /* No persistent `will-change: transform` here: it would make `.main` a
       containing block for `position: fixed` descendants, anchoring the chat
       dock to this wrapper instead of the viewport in menu-bar (horizontal)
       mode. The entrance animation still composites fine without it. */
  }
  @keyframes spring-from-top {
    0% { transform: translateY(-18px) scale(0.96); opacity: 0; }
    60% { transform: translateY(3px) scale(1.01); opacity: 1; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }

  /* ─── Brand ────────────────────────────────────────────── */
  .brand {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.25rem 0.875rem 0.5rem;
  }
  .brand-link {
    color: inherit;
    text-decoration: none;
    border-radius: 0.5rem;
    transition: background-color 160ms var(--ease-glass), color 160ms var(--ease-glass);
  }
  .brand-link:hover { background: var(--color-glass-tint); }
  .brand-link:hover .brand-mark { filter: brightness(1.15) saturate(1.15); }
  .brand-stack .brand-text {
    display: inline-flex;
    flex-direction: column;
    line-height: 1.05;
  }
  .brand-mark {
    color: var(--color-accent);
    font-size: 1.25rem;
    line-height: 1;
  }
  .brand-primary {
    font-weight: 700;
    font-size: 1.0625rem;
    letter-spacing: -0.015em;
  }
  .brand-suffix {
    color: var(--color-page-fg-muted);
    font-weight: 500;
    font-size: 0.6875rem;
    letter-spacing: 0.02em;
    margin-top: 0.0625rem;
  }
  .inline-brand { padding: 0; margin-right: 0.5rem; }

  /* ─── Nav ──────────────────────────────────────────────── */
  /* nav-group / nav-item styles live in layout.css (global) */

  /* ─── Sidebar footer & user chip ───────────────────────── */
  .sidebar-footer {
    margin-top: auto;
    padding-top: 0.75rem;
    display: flex;
    gap: 0.5rem;
    border-top: 1px solid var(--color-glass-border);
  }
  .sidebar-footer :global(.footer-action) { flex: 1; }

  .user-chip {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.625rem 0.75rem;
    border-radius: 0.625rem;
    background: var(--color-glass-tint);
    border: 1px solid var(--color-glass-border);
    font-size: 0.8125rem;
  }
  .user-name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .signout-link {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--color-page-fg-muted);
    font: inherit;
    font-size: 0.75rem;
    text-align: left;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .signout-link:hover { color: var(--color-page-fg); }

  /* ─── Toolbar mode ─────────────────────────────────────── */
  .main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    min-width: 0;
    padding: 0.5rem 0.875rem 0.875rem;
  }
  .toolbar-left, .toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }
  /* content must stretch full width despite parent align-items: center */

  .content {
    padding: 2rem 1.5rem 3rem;
    max-width: 1200px;
    width: 100%;
    align-self: stretch;
    margin: 0 auto;
    justify-self: center;
    flex: 1;
  }

  /* ─── Mobile ───────────────────────────────────────────── */
  .mobile-hamburger {
    display: none;
    position: fixed;
    top: 0.75rem;
    left: 0.75rem;
    z-index: 1010;
    width: auto;
    height: 2.75rem;
    padding: 0 0.625rem 0 0.3125rem;
    gap: 0.5rem;
    border-radius: 999px;
    align-items: center;
    justify-content: flex-start;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .mobile-hamburger.menu-open {
    width: 2.75rem;
    padding: 0;
    justify-content: center;
  }
  .hamburger-ring {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.125rem;
    height: 2.125rem;
    border-radius: 999px;
    flex-shrink: 0;
  }
  .hamburger-icon {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 14px;
  }
  .hamburger-icon span {
    display: block;
    height: 2px;
    width: 100%;
    background: var(--color-page-fg);
    border-radius: 999px;
    transition: transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 160ms ease;
    transform-origin: center;
  }
  .hamburger-icon.hamburger-open span:nth-child(1) { transform: translateY(6px) rotate(45deg); }
  .hamburger-icon.hamburger-open span:nth-child(2) { opacity: 0; }
  .hamburger-icon.hamburger-open span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }
  .hamburger-brand {
    display: flex;
    align-items: center;
    color: var(--color-accent);
    flex-shrink: 0;
  }

  .mobile-scrim {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: var(--color-modal-overlay);
    animation: scrim-fade-in 200ms ease forwards;
  }
  @keyframes scrim-fade-in { from { opacity: 0; } to { opacity: 1; } }

  .mobile-sidebar {
    display: none;
    position: fixed;
    top: 0.5rem;
    left: 0.5rem;
    bottom: 0.5rem;
    width: min(280px, calc(100vw - 4rem));
    z-index: 1001;
    flex-direction: column;
    gap: 1rem;
    padding: 3.5rem 0.875rem 1.25rem;
    border-radius: 1.5rem;
    overflow-y: auto;
    transform-origin: 1.375rem 1.375rem;
    animation: sidebar-spring-in 420ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  @keyframes sidebar-spring-in {
    0% { transform: scale(0.15); opacity: 0; border-radius: 999px; }
    40% { opacity: 1; border-radius: 2rem; }
    70% { transform: scale(1.03); }
    100% { transform: scale(1); opacity: 1; border-radius: 1.5rem; }
  }
  @media (max-width: 720px) {
    .mobile-hamburger { display: inline-flex; }
    .mobile-scrim { display: block; }
    .mobile-sidebar { display: flex; }
    .app-shell[data-shell='vertical'] { grid-template-columns: 1fr; }
    .app-shell { padding: 0.5rem; gap: 0.5rem; }
    .sidebar { display: none; }
    .inline-brand .brand-suffix { display: none; }
    .content { padding: 4.5rem 1rem 2rem; }
    .app-shell[data-shell='vertical'] > .content { padding-top: 4.5rem; }
  }
  @media (max-width: 480px) {
    .app-shell { padding: 0.375rem; }
    .mobile-hamburger { top: 0.5rem; left: 0.5rem; height: 2.5rem; padding: 0 0.5rem 0 0.25rem; }
    .mobile-sidebar { top: 0.375rem; left: 0.375rem; bottom: 0.375rem; padding-top: 3rem; }
    .content { padding: 4rem 1rem 1.5rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    .sidebar, .app-shell[data-shell='horizontal'] > .main { animation: none; }
    .app-shell { transition: none; }
    .mobile-sidebar { animation: none; }
    .mobile-scrim { animation: none; }
    .hamburger-icon span { transition: none; }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
