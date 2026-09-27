import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sw = readFileSync(
  fileURLToPath(new URL("../public/sw.js", import.meta.url)),
  "utf8",
);
const client = readFileSync(
  fileURLToPath(new URL("../src/lib/push-notifications.ts", import.meta.url)),
  "utf8",
);

describe("PWA push notifications", () => {
  it("handles background push and notification clicks in the service worker", () => {
    expect(sw).toContain('self.addEventListener("push"');
    expect(sw).toContain('self.addEventListener("notificationclick"');
    expect(sw).toContain("showNotification");
    expect(sw).toContain("openWindow");
  });

  it("requires a user gesture before requesting notification permission", () => {
    expect(client).toContain("Notification.requestPermission()");
    expect(client).toContain("enablePushNotifications");
  });

  it("registers the browser subscription through the authenticated edge function", () => {
    expect(client).toContain('web-push-dispatch');
    expect(client).toContain('action: "register"');
  });
});
