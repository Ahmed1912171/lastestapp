import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and get the Expo push token
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === "android") {
    // Create a notification channel for Android
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#00A652",
    });
  }

  if (Device.isDevice) {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("Failed to get push token for push notification!");
      return null;
    }

    // Get the project ID from EAS config
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      if (!projectId) {
        console.warn("Project ID not found in config, trying without projectId");
        // Try without projectId (uses default project from logged-in Expo account)
        const tokenData = await Notifications.getExpoPushTokenAsync();
        token = tokenData.data;
        console.log("📱 Expo Push Token:", token);
      } else {
        // Get Expo push token with projectId
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        token = tokenData.data;
        console.log("📱 Expo Push Token:", token);
      }
    } catch (e: any) {
      // Check if it's an EXPERIENCE_NOT_FOUND error
      const errorMessage = e?.message || String(e);
      if (errorMessage.includes("EXPERIENCE_NOT_FOUND") || errorMessage.includes("does not exist")) {
        console.warn("⚠️ Project ID not found in Expo. Trying without projectId...");
        try {
          // Fallback: try without projectId
          const tokenData = await Notifications.getExpoPushTokenAsync();
          token = tokenData.data;
          console.log("📱 Expo Push Token (fallback):", token);
        } catch (fallbackError) {
          console.warn("⚠️ Could not get push token. This is expected in Expo Go. Use a development build for push notifications.");
          token = null;
        }
      } else {
        console.error("Error getting push token:", e);
        token = null;
      }
    }
  } else {
    console.warn("Must use physical device for Push Notifications");
  }

  return token;
}

/**
 * Schedule a local notification
 * @param sound - Sound option: 'default' | 'defaultCritical' | 'custom' | string (filename) | true | false | null
 *   - 'default' or true: Default system notification sound
 *   - 'defaultCritical': Critical alert sound (iOS only, bypasses mute)
 *   - 'custom': Use custom sound (requires sound file in app.json)
 *   - string: Custom sound filename (e.g., 'notification.wav')
 *   - false or null: No sound
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  seconds: number = 2,
  sound: boolean | string | null = true
): Promise<string | null> {
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: sound === true ? 'default' : sound === false ? null : sound,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
      },
    });
    return identifier;
  } catch (error) {
    console.error("Error scheduling notification:", error);
    return null;
  }
}

/**
 * Cancel a scheduled notification
 */
export async function cancelScheduledNotification(
  identifier: string
): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.error("Error canceling notification:", error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error("Error canceling all notifications:", error);
  }
}

/**
 * Get badge count
 */
export async function getBadgeCount(): Promise<number> {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch (error) {
    console.error("Error getting badge count:", error);
    return 0;
  }
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number): Promise<boolean> {
  try {
    return await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error("Error setting badge count:", error);
    return false;
  }
}

/**
 * Clear badge
 */
export async function clearBadge(): Promise<boolean> {
  return setBadgeCount(0);
}

