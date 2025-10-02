import { Stack } from "expo-router";
import { SessionProvider, useSession } from "../ctx";
import { SplashScreenController } from "../splash";

export default function Root() {
  return (
    <SessionProvider>
      <SplashScreenController />
      <RootNavigator />
    </SessionProvider>
  );
}

function RootNavigator() {
  const { session } = useSession();

  return (
    <Stack>
      {/* Authenticated area */}
      <Stack.Protected guard={!!session}>
        <Stack.Screen
          name="(app)"
          options={{ headerShown: false }} // 🚀 hides "(app)" from top bar
        />
      </Stack.Protected>

      {/* Public login */}
      <Stack.Protected guard={!session}>
        <Stack.Screen
          name="sign-in"
          options={{ headerShown: false }} // 🚀 hides "sign-in" from top bar
        />
      </Stack.Protected>
    </Stack>
  );
}
