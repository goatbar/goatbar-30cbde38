import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY =
  "BGVHHsVGDBKK23EN3dBCF36JFdvPGeZiMGmooyIXfyiCAYFtBcGf65eRhSsxIYIdykIG3z9wcIS8dN5G-MvV0tQ";

export type PushNotificationState =
  | "loading"
  | "unsupported"
  | "needs_install"
  | "prompt"
  | "enabled"
  | "denied"
  | "error";

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

function pushSupported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function registerSubscription(subscription: PushSubscription) {
  const serialized = subscription.toJSON();
  const endpoint = serialized.endpoint;
  const p256dh = serialized.keys?.p256dh;
  const auth = serialized.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error("Assinatura push incompleta.");
  }

  const { data, error } = await supabase.functions.invoke("web-push-dispatch", {
    body: {
      action: "register",
      subscription: { endpoint, keys: { p256dh, auth } },
      user_agent: navigator.userAgent,
    },
  });

  if (error) throw error;
  if (!data?.success) {
    throw new Error(data?.error || "Não foi possível registrar as notificações.");
  }
}

export async function getPushNotificationState(): Promise<PushNotificationState> {
  if (typeof window === "undefined") return "unsupported";

  if (isIosDevice() && !isStandalone()) {
    return "needs_install";
  }

  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription && Notification.permission === "granted") {
      return "enabled";
    }
    return "prompt";
  } catch {
    return "error";
  }
}

export async function syncPushRegistration() {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await registerSubscription(subscription);
  }
}

export async function sendTestPushNotification() {
  const { data, error } = await supabase.functions.invoke("web-push-dispatch", {
    body: { action: "test" },
  });
  if (error) throw error;
  if (!data?.success) {
    throw new Error(data?.error || "Não foi possível enviar a notificação de teste.");
  }
}

export async function enablePushNotifications() {
  if (!pushSupported()) {
    throw new Error("Este dispositivo não oferece suporte a notificações push.");
  }

  if (isIosDevice() && !isStandalone()) {
    throw new Error("Instale o Goat Bar na Tela de Início antes de ativar as notificações.");
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Permissão de notificações não concedida.");
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await registerSubscription(subscription);

  await sendTestPushNotification();
}
