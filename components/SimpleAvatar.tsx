// components/SimpleAvatar.tsx
import React from "react";
import { Image, StyleSheet, View } from "react-native";

type SimpleAvatarProps = {
  uri?: string; // optional image URL
  size?: number; // avatar size
  fallback?: string; // fallback text if no image
};

export default function SimpleAvatar({
  uri,
  size = 80,
  fallback = "A",
}: SimpleAvatarProps) {
  return (
    <View
      style={[
        styles.avatarFrame,
        {
          width: size + 8, // add padding for frame
          height: size + 8,
          borderRadius: (size + 8) / 2,
        },
      ]}
    >
      <View
        style={[
          styles.avatar,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
          />
        ) : (
          <Image
            source={require("../app/images/doctor.png")}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            resizeMode="cover"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarFrame: {
    borderWidth: 3,
    borderColor: "#00A652", // emerald green
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    backgroundColor: "#ddd",
    overflow: "hidden",
  },
  label: {
    color: "#555",
    fontWeight: "600",
  },
});
