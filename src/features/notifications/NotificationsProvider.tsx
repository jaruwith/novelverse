"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import {
  hasSession, subscribeToCrossTabSessionChanges, subscribeToSessionChanges,
} from "@/features/novel-editor/api";
import { NotificationsController } from "./controller";

const NotificationsContext = createContext<NotificationsController | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [controller] = useState(() => new NotificationsController());

  useEffect(() => {
    const synchronize = () => controller.setSession(hasSession());
    const focus = () => controller.handleFocusOrVisibility();
    const visibility = () => document.visibilityState === "visible"
      ? controller.handleFocusOrVisibility() : controller.handleOfflineOrHidden();
    const online = () => controller.handleFocusOrVisibility();
    const offline = () => controller.handleOfflineOrHidden();
    synchronize();
    const unsubscribe = subscribeToSessionChanges(synchronize);
    const unsubscribeStorage = subscribeToCrossTabSessionChanges(synchronize);
    window.addEventListener("focus", focus);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      unsubscribe(); unsubscribeStorage();
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visibility);
      controller.destroy();
    };
  }, [controller]);

  return <NotificationsContext.Provider value={controller}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const controller = useContext(NotificationsContext);
  if (!controller) throw new Error("useNotifications must be used inside NotificationsProvider.");
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  return { controller, state };
}
