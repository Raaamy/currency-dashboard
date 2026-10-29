import '@testing-library/jest-dom/vitest';

// Persisted settings/caches (`wissel.*`) must not leak between tests.
afterEach(() => {
  localStorage.clear();
});
