import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerForPushNotificationsAsync } from "../services/notifications";

export interface PushNotificationState {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  notificationResponse: Notifications.NotificationResponse | null;
}

/**
 * Hook to manage push notifications
 * Handles token registration and notification listeners
 */
export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);
  const [notificationResponse, setNotificationResponse] =
    useState<Notifications.NotificationResponse | null>(null);

  const notificationListener = useRef<Notifications.EventSubscription | null>(
    null
  );
  const responseListener = useRef<Notifications.EventSubscription | null>(
    null
  );

  useEffect(() => {
    // Register for push notifications
    registerForPushNotificationsAsync().then((token) => {
      setExpoPushToken(token);
    });

    // Listen for notifications received while app is in foreground
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("📬 Notification received:", notification);
        setNotification(notification);
      });

    // Listen for user interactions with notifications
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("👆 Notification response:", response);
        setNotificationResponse(response);
      });

    // Get last notification response (when app opens from notification)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        console.log("📱 Last notification response:", response);
        setNotificationResponse(response);
      }
    });

    return () => {
      // Cleanup listeners
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return {
    expoPushToken,
    notification,
    notificationResponse,
  };
}

