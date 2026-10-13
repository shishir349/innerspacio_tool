// Test-only stand-in for the real `server-only` package. The real package
// unconditionally throws unless Next's bundler strips it out of a true
// server build; under Vitest there's no such bundler step, so this no-op
// stub takes its place for tests (see vitest.config.ts alias). The actual
// app still uses the real package via Next's build — this only affects
// what `import "server-only"` resolves to inside `vitest run`.
export {};
