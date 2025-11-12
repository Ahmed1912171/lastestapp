import axios from "axios";
import { Asset } from "expo-asset"; // ✅ for preloading
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSession } from "../ctx";
import colors from "./theme/colors";
export default function LoginScreen() {
  const { signIn } = useSession();
  const router = useRouter();

  const [username, setUsername] = useState("1462");
  const [password, setPassword] = useState("130481-0429"); // ✅ Empty - user must enter correct password
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bgLoaded, setBgLoaded] = useState(false); // ✅ track bg preload

  const LOCAL_IP = "192.168.100.93";

  const API_URL =
    Platform.OS === "android"
      ? "http://10.0.2.2:3000/admin"
      : `http://${LOCAL_IP}:3000/admin`;

  // ✅ Preload background image before rendering
  useEffect(() => {
    async function loadBg() {
      try {
        await Asset.fromModule(require("./images/bg.jpg")).downloadAsync();
        setBgLoaded(true);
      } catch (err) {
        console.error("Error loading bg:", err);
        setBgLoaded(true); // still show screen even if preload fails
      }
    }
    loadBg();
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      alert("Please enter Username and Password");
      return;
    }

    try {
      setLoading(true);
      
      // ✅ Use POST /login endpoint instead of GET /admin
      const LOGIN_URL = Platform.OS === "android"
        ? "http://10.0.2.2:3000/login"
        : `http://${LOCAL_IP}:3000/login`;

      const res = await axios.post(LOGIN_URL, {
        username,
        password,
        branch: "korangi", // Default branch, can be made dynamic later
      });

      if (res.data.success && res.data.user) {
        const userData = res.data.user;
        
        // ✅ Pass complete user data to session (including pinNumber)
        signIn({
          ADMIN_ID: userData.ADMIN_ID,
          GR_EMPLOYER_LOGIN: userData.GR_EMPLOYER_LOGIN,
          pinNumber: userData.pinNumber,
          branch: "korangi",
        });
        
        router.replace("/");
      } else {
        alert("❌ Invalid Username or Password");
      }
    } catch (err: any) {
      console.error("Login error:", err.message);
      
      if (err.response?.status === 401) {
        alert("❌ Invalid Username or Password");
      } else {
        alert(`Something went wrong: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ Show loader until background is ready
  if (!bgLoaded) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ImageBackground
        source={require("./images/bg.jpg")}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          {/* Logo */}
          <Image
            source={require("./images/Sichnlogo.png")}
            style={styles.logo}
          />

          {/* Username */}
          <TextInput
            placeholder="Username (ID)"
            placeholderTextColor="#999"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            keyboardType="numeric"
            style={styles.input}
          />

          {/* Password */}
          <View style={styles.passwordContainer}>
            <TextInput
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={styles.passwordInput}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.showButton}
            >
              <Text style={styles.showButtonText}>
                {showPassword ? "Hide" : "Show"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Remember Me */}
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setRememberMe(!rememberMe)}
          >
            <View
              style={[styles.checkbox, rememberMe && styles.checkboxChecked]}
            />
            <Text style={styles.checkboxLabel}>Remember me</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>
              {loading ? "Logging in..." : "Login"}
            </Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: "center",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.85)", // ✅ overlay for readability
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 40,
    resizeMode: "contain",
  },
  input: {
    width: "100%",
    height: 45,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 15,
    fontSize: 16,
    color: "#000",
    backgroundColor: "#fff",
  },
  passwordContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  passwordInput: {
    flex: 1,
    height: 45,
    fontSize: 16,
    color: "#000",
  },
  showButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  showButtonText: {
    color: colors.primary,
    fontWeight: "600",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: "#333",
    marginRight: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#333",
  },
  loginButton: {
    backgroundColor: colors.primary,
    width: "100%",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
