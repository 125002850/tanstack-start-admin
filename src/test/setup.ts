import '@testing-library/jest-dom/vitest';

// Radix UI Tooltip uses ResizeObserver internally (via @radix-ui/react-use-size).
// jsdom doesn't provide it natively — stub it so Tooltip doesn't crash in tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
