// html2pdf's UMD wrapper reads `self` while loading. Browsers provide it; the
// Node test environment does not, so expose the equivalent global explicitly.
Object.defineProperty(globalThis, "self", {
  value: globalThis,
  configurable: true,
});
