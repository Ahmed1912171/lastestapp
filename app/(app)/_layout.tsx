import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Dimensions, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler"; // ✅ Added
import { useTheme } from "../../ctx/theme";

export default function AppLayout() {
  const { width } = Dimensions.get("window");
  const isTablet = width >= 800; // 👈 Detect tablet screens
  const { isDarkMode } = useTheme();
  const tabBackground = isDarkMode ? "#000000" : "#fff";
  const activeTint = isDarkMode ? "#ffffff" : "#00A652";
  const inactiveTint = isDarkMode ? "#9ca3af" : "#8e8e93";
  const borderColor = isDarkMode ? "#1a1a1a" : "#e5e7eb";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* ✅ Wrap everything */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: activeTint,
          tabBarInactiveTintColor: inactiveTint,
          tabBarStyle: {
            backgroundColor: tabBackground,

            // ✅ Height and padding
            height: isTablet
              ? Platform.OS === "ios"
                ? 95
                : 85
              : Platform.OS === "ios"
                ? 70
                : 60,
            paddingBottom: isTablet ? 25 : Platform.OS === "ios" ? 10 : 6,
            paddingTop: isTablet ? 12 : 0,

            // ✅ Border and shadows
            borderTopWidth: 0,
            borderTopColor: tabBackground,
            elevation: isTablet ? 14 : 0,
            shadowColor: isDarkMode ? "#000" : "#000",
            shadowOpacity: isTablet ? 0.2 : 0.08,
            shadowRadius: isTablet ? 10 : 5,
            shadowOffset: { width: 0, height: 6 },

            // ✅ Floating position (tablet only)
            position: isTablet ? "absolute" : "relative",
            bottom: isTablet ? 55 : 0,
            left: isTablet ? 60 : 0,
            right: isTablet ? 60 : 0,
            borderRadius: isTablet ? 35 : 0,
          },
        }}
      >
        {/* 🏠 Home */}
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={26}
                color={color}
              />
            ),
          }}
        />

        {/* 👥 Patients */}
        <Tabs.Screen
          name="patients"
          options={{
            title: "Patients",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "people" : "people-outline"}
                size={26}
                color={color}
              />
            ),
          }}
        />

        {/* 👤 Profile */}
        <Tabs.Screen
          name="hris"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
              name={focused ? "document-text" : "document-text-outline"}
                size={26}
                color={color}
              />
            ),
          }}
        />

        

        {/* 🔍 Search */}
        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "search" : "search-outline"}
                size={26}
                color={color}
              />
            ),
          }}
        />

        {/* 👤 Profile */}
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={26}
                color={color}
              />
            ),
          }}
        />
       
      </Tabs>
    </GestureHandlerRootView>
  );
}
