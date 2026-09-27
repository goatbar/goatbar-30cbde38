export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // The app must remain fully usable even if service worker registration fails.
    });
  });
}
