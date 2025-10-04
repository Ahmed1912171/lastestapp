// app/splashController.tsx
import React, { useEffect, useState } from "react";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import SplashScreen from "./splash"; // ✅ imports your existing animation

export function SplashScreenController() {
  const [isVisible, setIsVisible] = useState(true);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      // Fade out animation
      opacity.value = withTiming(0, { duration: 800 });
      setTimeout(() => setIsVisible(false), 800);
    }, 4000); // Show splash for 4 seconds

    return () => clearTimeout(timer);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!isVisible) return null;

  return (
    <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }, animatedStyle]}>
      <SplashScreen />
    </Animated.View>
  );
}
