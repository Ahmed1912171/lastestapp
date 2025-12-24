import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import React from "react";
import {
  Alert,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SimpleAvatar from "../../components/SimpleAvatar";
import { useSession } from "../../ctx";
import { useTheme } from "../../ctx/theme"; // ✅ global theme hook
import { scheduleLocalNotification } from "../../services/notifications";

export default function Profile() {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { session, signOut } = useSession();

  const userAny = session?.user as any;
  const hasNameFields =
    !!userAny && ("ADMIN_FIRST_NAME" in userAny || "ADMIN_LAST_NAME" in userAny);

  const adminFirstName = hasNameFields
    ? (userAny?.ADMIN_FIRST_NAME as string | null | undefined)
    : undefined;
  const adminLastName = hasNameFields
    ? (userAny?.ADMIN_LAST_NAME as string | null | undefined)
    : undefined;
  const grEmployer = session?.user?.GR_EMPLOYER_LOGIN?.split("-")[0] || "User";

  const displayName = hasNameFields
    ? ` ${adminFirstName ?? "null"} ${adminLastName ?? "null"}`.trim()
    : ` ${grEmployer}`;

  const staffId = session?.user?.pinNumber
    ? `PIN: ${session.user.pinNumber}`
    : session?.user?.ADMIN_ID
    ? `ID: ${session.user.ADMIN_ID}`
    : "ID: ----";

  const handleTestNotification = async () => {
    try {
      await scheduleLocalNotification(
        "Test Notification",
        "This is a test notification from your profile!",
        { type: "test", timestamp: Date.now() },
        2,
        'ting.wav' // Custom "ting" bell sound
      );
      Alert.alert("Success", "Test notification scheduled! It will appear in 2 seconds.");
    } catch (error) {
      Alert.alert("Error", "Failed to schedule notification. Make sure you're on a physical device.");
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: isDarkMode ? "#121212" : "#f9fafb" },
      ]}
    >
      <View style={styles.container}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.headerRow}>
            <View style={styles.avatarContainer}>
              <SimpleAvatar
                fallback={displayName
                  .replace("Dr. ", "")
                  .split(" ")
                  .filter(Boolean)
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
                size={90}
              />
            </View>
            <TouchableOpacity
              style={[
                styles.testNotificationButton,
                { backgroundColor: isDarkMode ? "#1f1f1f" : "#e5e7eb" },
              ]}
              onPress={handleTestNotification}
              activeOpacity={0.7}
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color={isDarkMode ? "#00A652" : "#00A652"}
              />
            </TouchableOpacity>
          </View>
          <Text style={[styles.name, { color: isDarkMode ? "#fff" : "#111" }]}>
            {displayName}
          </Text>
        </View>

        {/* Info Section */}
        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <Feather name="hash" size={20} color="#6b7280" />
            <Text
              style={[
                styles.infoText,
                { color: isDarkMode ? "#fff" : "#111" },
              ]}
            >
              {staffId}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <MaterialIcons name="email" size={20} color="#6b7280" />
            <Text
              style={[
                styles.infoText,
                { color: isDarkMode ? "#fff" : "#111" },
              ]}
            >
              {session?.user?.GR_EMPLOYER_LOGIN || "N/A"}
            </Text>
          </View>

          <View style={styles.darkModeRow}>
            <Text
              style={[
                styles.infoLabel,
                { color: isDarkMode ? "#fff" : "#111" },
              ]}
            >
              Dark Mode
            </Text>
            <Switch
              value={isDarkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: "#d1d5db", true: "#2563eb" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Edit Profile Button */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#3b82f6" }]}
        >
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.buttonText}>Edit Profile</Text>
        </TouchableOpacity>

        {/* Sign Out */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#ef4444" }]}
          onPress={signOut}
        >
          <MaterialIcons name="logout" size={20} color="#fff" />
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ✅ ADD THIS PART
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, padding: 20 },
  profileHeader: { alignItems: "center", marginVertical: 24 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    position: "relative",
  },
  avatarContainer: {
    alignItems: "center",
  },
  testNotificationButton: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#00A652",
  },
  name: { fontSize: 26, fontWeight: "700", marginTop: 12 },

  infoContainer: {
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },
  infoText: { fontSize: 16, marginLeft: 12 },

  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16, marginLeft: 8 },

  darkModeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },

  infoLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
});
