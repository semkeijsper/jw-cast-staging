import { vi } from 'vitest';

// happy-dom lacks these browser APIs that Vuetify components touch on mount.
class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

vi.stubGlobal('ResizeObserver', Observer);
vi.stubGlobal('IntersectionObserver', Observer);

if (!window.matchMedia) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

// Vuetify overlay location strategies (v-select/v-menu/v-dialog) read
// window.visualViewport, which happy-dom does not define.
if (!window.visualViewport) {
  vi.stubGlobal('visualViewport', {
    width: 1024,
    height: 768,
    offsetLeft: 0,
    offsetTop: 0,
    scale: 1,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

// No layout in happy-dom; the transcript panel scrolls the active cue into view
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
