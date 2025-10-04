import { Stack } from "expo-router";
import { SessionProvider, useSession } from "../ctx";
import { ThemeProvider } from "../ctx/theme"; // ✅ Dark mode context
import { SplashScreenController } from "../splashController";

export default function Root() {
  return (
    <SessionProvider>
      <ThemeProvider>
        <SplashScreenController />
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
