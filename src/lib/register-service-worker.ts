export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    let hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    void navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .then((registration) => {
        const checkForUpdate = () => registration.update().catch(() => undefined);

        void checkForUpdate();

        const intervalId = window.setInterval(checkForUpdate, 15 * 60 * 1000);
        const handleVisibility = () => {
          if (document.visibilityState === "visible") {
            void checkForUpdate();
          }
        };
        const handleFocus = () => void checkForUpdate();

        document.addEventListener("visibilitychange", handleVisibility);
        window.addEventListener("focus", handleFocus);

        window.addEventListener(
          "beforeunload",
          () => {
            window.clearInterval(intervalId);
            document.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("focus", handleFocus);
          },
          { once: true },
        );
      })
      .catch(() => {
        // The app must remain fully usable even if service worker registration fails.
      });
  });
}
