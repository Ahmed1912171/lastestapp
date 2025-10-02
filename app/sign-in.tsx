import axios from "axios";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSession } from "../ctx"; // ✅ useSession from ctx, not old AuthContext
import colors from "./theme/colors"; // ✅ keep your theme

export default function LoginScreen() {
  const { signIn } = useSession(); // ✅ call signIn from ctx
  const router = useRouter();

  const [username, setUsername] = useState("1"); // default for testing
  const [password, setPassword] = useState("admin");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ Local server IP (your PC)
  const LOCAL_IP = "192.168.100.102";

  // ✅ API URL depending on platform
  const API_URL =
    Platform.OS === "android"
      ? "http://10.0.2.2:3000/" // Android Emulator
      : `http://${LOCAL_IP}:3000/admin`; // iOS/physical device

  const handleLogin = async () => {
    if (!username || !password) {
      alert("Please enter Username and Password");
      return;
    }

    try {
      setLoading(true);

      // Fetch all users
      const res = await axios.get(API_URL);
      const users: any[] = res.data || [];

      if (!users.length) {
        alert("⚠️ No users found in the database");
        return;
      }

      // Match user by ADMIN_ID and GR_EMPLOYER_LOGIN
      const matchedUser = users.find(
        (u) =>
          u.ADMIN_ID?.toString() === username &&
          u.GR_EMPLOYER_LOGIN === password
      );

      if (matchedUser) {
        signIn(); // ✅ mark as logged in via ctx
        router.replace("/"); // ✅ redirect into (app) stack
      } else {
        alert("❌ Invalid Username or Password");
      }
    } catch (err: any) {
      console.error("Login error:", err.message);
      alert(`Something went wrong: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        {/* Logo */}
        <Image source={require("./images/Sichnlogo.png")} style={styles.logo} />

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
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
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












////////////delete from below


// Filename: src/screens/LoginScreen.tsx
// import { useRouter } from "expo-router";
// import React, { useState } from "react";
// import {
//   Image,
//   Keyboard,
//   Platform,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   TouchableWithoutFeedback,
//   View,
// } from "react-native";
// import { useSession } from "../ctx"; // ✅ useSession from ctx, not old AuthContext
// import colors from "./theme/colors"; // ✅ keep your theme

// /**
//  * DEV_SKIP_AUTH:
//  *  - true  -> Immediately sign in with a mocked user (development convenience).
//  *  - false -> Use real network login (uncomment the real logic below if needed).
//  *
//  * IMPORTANT: make sure this flag is disabled for production builds.
//  */
// const DEV_SKIP_AUTH = true;

// export default function LoginScreen() {
//   const { signIn } = useSession(); // call signIn from ctx (assumes ctx handles setting user/session)
//   const router = useRouter();

//   const [username, setUsername] = useState("1"); // default for testing
//   const [password, setPassword] = useState("admin");
//   const [rememberMe, setRememberMe] = useState(false);
//   const [showPassword, setShowPassword] = useState(false);
//   const [loading, setLoading] = useState(false);

//   // Local server IP (change to your PC IP if you want to test real API)
//   const LOCAL_IP = "192.168.100.102";

//   // API URL depending on platform
//   const API_URL =
//     Platform.OS === "android"
//       ? "http://10.0.2.2:3000/"
//       : `http://${LOCAL_IP}:3000/admin`;

//   // Mock user to populate ctx when bypassing auth
//   const DEV_MOCK_USER = {
//     id: "dev-1",
//     name: "Dev User",
//     email: "dev@example.com",
//     role: "developer",
//     // add any other fields your app expects, e.g. hospital_id, token, permissions, etc.
//   };

//   const handleLogin = async () => {
//     // DEV shortcut: bypass remote authentication and sign-in locally
//     if (DEV_SKIP_AUTH) {
//       try {
//         setLoading(true);
//         // If your useSession.signIn expects a payload, pass the mock user; if it only toggles state, adjust accordingly.
//         // Here we call signIn with a mock user object to ensure downstream UI has user data.
//         // If your signIn signature is different, update this call to match your ctx API.
//         signIn(DEV_MOCK_USER);
//         // Navigate into app (replace the current route)
//         router.replace("/");
//       } catch (err: any) {
//         console.warn("Dev sign-in failed:", err?.message ?? err);
//         alert("Dev sign-in failed. See console.");
//       } finally {
//         setLoading(false);
//       }
//       return;
//     }

//     // --- Original network-based login logic (kept for reference) ---
//     // Uncomment and use when you want to re-enable real authentication.
//     /*
//     if (!username || !password) {
//       alert("Please enter Username and Password");
//       return;
//     }

//     try {
//       setLoading(true);

//       // Fetch all users
//       const res = await axios.get(API_URL);
//       const users: any[] = res.data || [];

//       if (!users.length) {
//         alert("⚠️ No users found in the database");
//         return;
//       }

//       // Match user by ADMIN_ID and GR_EMPLOYER_LOGIN
//       const matchedUser = users.find(
//         (u) =>
//           u.ADMIN_ID?.toString() === username &&
//           u.GR_EMPLOYER_LOGIN === password
//       );

//       if (matchedUser) {
//         // pass matched user to signIn if your context accepts a user object
//         signIn(matchedUser);
//         router.replace("/");
//       } else {
//         alert("❌ Invalid Username or Password");
//       }
//     } catch (err: any) {
//       console.error("Login error:", err.message);
//       alert(`Something went wrong: ${err.message}`);
//     } finally {
//       setLoading(false);
//     }
//     */
//   };

//   return (
//     <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
//       <View style={styles.container}>
//         {/* Logo */}
//         <Image
//           source={require("./images/Sichnlogo.png")}
//           style={styles.logo}
//         />

//         {/* Username */}
//         <TextInput
//           placeholder="Username (ID)"
//           placeholderTextColor="#999"
//           value={username}
//           onChangeText={setUsername}
//           autoCapitalize="none"
//           keyboardType="numeric"
//           style={styles.input}
//         />

//         {/* Password */}
//         <View style={styles.passwordContainer}>
//           <TextInput
//             placeholder="Password"
//             placeholderTextColor="#999"
//             value={password}
//             onChangeText={setPassword}
//             secureTextEntry={!showPassword}
//             style={styles.passwordInput}
//           />
//           <TouchableOpacity
//             onPress={() => setShowPassword(!showPassword)}
//             style={styles.showButton}
//           >
//             <Text style={styles.showButtonText}>
//               {showPassword ? "Hide" : "Show"}
//             </Text>
//           </TouchableOpacity>
//         </View>

//         {/* Remember Me */}
//         <TouchableOpacity
//           style={styles.checkboxContainer}
//           onPress={() => setRememberMe(!rememberMe)}
//         >
//           <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]} />
//           <Text style={styles.checkboxLabel}>Remember me</Text>
//         </TouchableOpacity>

//         {/* Login Button */}
//         <TouchableOpacity
//           style={[styles.loginButton, loading && { opacity: 0.6 }]}
//           onPress={handleLogin}
//           disabled={loading}
//         >
//           <Text style={styles.loginButtonText}>
//             {loading ? "Logging in..." : "Login"}
//           </Text>
//         </TouchableOpacity>

//         {/* Helpful note for dev */}
//         {DEV_SKIP_AUTH && (
//           <Text style={styles.devNote}>
//             Dev mode: authentication skipped — you will be signed in automatically.
//           </Text>
//         )}
//       </View>
//     </TouchableWithoutFeedback>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     padding: 20,
//     backgroundColor: "#fff",
//   },
//   logo: {
//     width: 200,
//     height: 200,
//     marginBottom: 40,
//     resizeMode: "contain",
//   },
//   input: {
//     width: "100%",
//     height: 45,
//     borderWidth: 1,
//     borderColor: colors.primary,
//     borderRadius: 8,
//     paddingHorizontal: 10,
//     marginBottom: 15,
//     fontSize: 16,
//     color: "#000",
//   },
//   passwordContainer: {
//     width: "100%",
//     flexDirection: "row",
//     alignItems: "center",
//     borderWidth: 1,
//     borderColor: colors.primary,
//     borderRadius: 8,
//     marginBottom: 15,
//     paddingHorizontal: 10,
//   },
//   passwordInput: {
//     flex: 1,
//     height: 45,
//     fontSize: 16,
//     color: "#000",
//   },
//   showButton: {
//     paddingHorizontal: 8,
//     paddingVertical: 4,
//   },
//   showButtonText: {
//     color: colors.primary,
//     fontWeight: "600",
//   },
//   checkboxContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//     marginBottom: 20,
//     alignSelf: "flex-start",
//   },
//   checkbox: {
//     width: 20,
//     height: 20,
//     borderWidth: 1,
//     borderColor: "#333",
//     marginRight: 8,
//     borderRadius: 4,
//   },
//   checkboxChecked: {
//     backgroundColor: colors.primary,
//   },
//   checkboxLabel: {
//     fontSize: 14,
//     color: "#333",
//   },
//   loginButton: {
//     backgroundColor: colors.primary,
//     width: "100%",
//     paddingVertical: 14,
//     borderRadius: 8,
//     alignItems: "center",
//     marginTop: 10,
//   },
//   loginButtonText: {
//     color: "#fff",
//     fontSize: 16,
//     fontWeight: "bold",
//   },
//   devNote: {
//     marginTop: 12,
//     color: "#666",
//     fontSize: 12,
//     textAlign: "center",
//   },
// });
