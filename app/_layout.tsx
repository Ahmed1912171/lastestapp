import { useEffect } from "react";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import { SessionProvider, useSession } from "../ctx";
import { ThemeProvider } from "../ctx/theme"; // ✅ Dark mode context
import { SplashScreenController } from "../splashController";
import { usePushNotifications } from "../hooks/usePushNotifications";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function NotificationHandler() {
  const { notificationResponse } = usePushNotifications();

  useEffect(() => {
    // Handle notification navigation when app opens from notification
    if (notificationResponse) {
      const url = notificationResponse.notification.request.content.data?.url;
      if (typeof url === "string") {
        router.push(url);
      }
    }
  }, [notificationResponse]);

  return null;
}

export default function Root() {
  return (
    <SessionProvider>
      <ThemeProvider>
        <SplashScreenController />
        <NotificationHandler />
        <RootNavigator />
      </ThemeProvider>
    </SessionProvider>
  );
}

function RootNavigator() {
  const { session } = useSession();

  return (
    <Stack>
      {/* ✅ Authenticated area */}
      <Stack.Screen
        name="(app)"
        options={{ headerShown: false }}
        redirect={!session} // redirect to login if not logged in
      />

      {/* ✅ Public login */}
      <Stack.Screen
        name="sign-in"
        options={{ headerShown: false }}
        redirect={!!session} // redirect to home if already logged in
      />
    </Stack>
  );
}
