import axios from "axios";
import { Platform } from "react-native";
import { registerForPushNotificationsAsync } from "./notifications";

const LOCAL_IP = "192.168.101.39";
const API_BASE =
  Platform.OS === "android" ? "http://10.0.2.2:3000" : `http://${LOCAL_IP}:3000`;

/**
 * Register push token with backend
 * Call this after user logs in or when token changes
 */
export async function registerPushTokenWithBackend(
  userId: string | number | undefined,
  pinNumber: string | number | undefined,
  branch?: string
): Promise<boolean> {
  try {
    // Get push token
    const pushToken = await registerForPushNotificationsAsync();
    
    if (!pushToken) {
      console.warn("No push token available");
      return false;
    }

    if (!userId && !pinNumber) {
      console.warn("No user ID or pin number provided");
      return false;
    }

    // Send token to backend
    const response = await axios.post(
      `${API_BASE}/users/push-token`,
      {
        userId: userId || pinNumber,
        pinNumber,
        pushToken,
        platform: Platform.OS,
        branch,
      },
      { timeout: 5000 }
    );

    if (response.status === 200) {
      console.log("✅ Push token registered successfully");
      return true;
    }

    return false;
  } catch (error: any) {
    console.error("Error registering push token:", error.message);
    return false;
  }
}

/**
 * Unregister push token from backend
 * Call this when user logs out
 */
export async function unregisterPushTokenFromBackend(
  userId: string | number | undefined,
  pinNumber: string | number | undefined
): Promise<boolean> {
  try {
    if (!userId && !pinNumber) {
      console.warn("No user ID or pin number provided");
      return false;
    }

    const response = await axios.post(
      `${API_BASE}/users/push-token/remove`,
      {
        userId: userId || pinNumber,
        pinNumber,
      },
      { timeout: 5000 }
    );

    if (response.status === 200) {
      console.log("✅ Push token unregistered successfully");
      return true;
    }

    return false;
  } catch (error: any) {
    console.error("Error unregistering push token:", error.message);
    return false;
  }
}

