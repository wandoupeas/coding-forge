import React from 'react';
import { render } from '@testing-library/react';
import App from '../App';
import { MantineProvider } from '@mantine/core';
import { forgeGlobalStyles, forgeTheme } from '../theme';

function ensureMatchMedia() {
  const testWindow = window as Window & { matchMedia?: typeof window.matchMedia };

  if (typeof testWindow.matchMedia === 'function') {
    return;
  }

  testWindow.matchMedia = () =>
    ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false
    }) as MediaQueryList;
}

function ensureResizeObserver() {
  const testWindow = window as Window & {
    ResizeObserver?: typeof ResizeObserver;
  };

  if (typeof testWindow.ResizeObserver === 'function') {
    return;
  }

  class ResizeObserverPolyfill {
    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  }

  testWindow.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver;
}

export function renderWithMantine(ui: React.ReactNode) {
  ensureMatchMedia();
  ensureResizeObserver();

  return render(
    <MantineProvider theme={forgeTheme}>
      <style>{forgeGlobalStyles}</style>
      {ui}
    </MantineProvider>
  );
}

export function renderApp(route = '/') {
  ensureMatchMedia();
  ensureResizeObserver();
  window.history.pushState({}, 'WebForge Test Route', route);
  return render(<App />);
}
