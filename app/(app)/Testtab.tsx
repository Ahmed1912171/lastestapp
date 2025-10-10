import axios from "axios";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// === Set your PC LAN IP here (the server listens on 0.0.0.0) ===
const BACKEND_BASE = "http://192.168.100.147:3000";

const ChatGPTTab = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const resp = await axios.post(
        `${BACKEND_BASE}/chat`,
        { messages: [...messages, userMessage] },
        { timeout: 30000 }
      );

      // if server returned an error object, show it
      if (resp.data?.error) {
        throw new Error(JSON.stringify(resp.data));
      }

      const gptText =
        resp.data?.choices?.[0]?.message?.content ??
        resp.data?.choices?.[0]?.text ??
        "No reply.";

      const gptMessage: Message = {
        id: Date.now().toString() + "_gpt",
        role: "assistant",
        content: gptText,
      };

      setMessages((prev) => [...prev, gptMessage]);
    } catch (err: any) {
      console.error("Chat Error:", err?.response?.data ?? err.message ?? err);
      const errorMsg: Message = {
        id: Date.now().toString() + "_error",
        role: "assistant",
        content:
          "⚠️ Cannot reach server / OpenAI failed. Check server console and your network.",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        120
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 10 }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageContainer,
              item.role === "user" ? styles.userBubble : styles.gptBubble,
            ]}
          >
            <Text
              style={item.role === "user" ? styles.userText : styles.gptText}
            >
              {item.content}
            </Text>
          </View>
        )}
      />
      {loading && (
        <View style={{ padding: 10 }}>
          <ActivityIndicator size="small" color="#00A652" />
        </View>
      )}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          multiline
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={sendMessage}
          disabled={loading}
        >
          <Text style={{ color: "white", fontWeight: "bold" }}>
            {loading ? "..." : "Send"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  messageContainer: {
    marginVertical: 5,
    padding: 10,
    borderRadius: 12,
    maxWidth: "80%",
  },
  userBubble: {
    backgroundColor: "#00A652",
    alignSelf: "flex-end",
    borderTopRightRadius: 0,
  },
  gptBubble: {
    backgroundColor: "#e5e5ea",
    alignSelf: "flex-start",
    borderTopLeftRadius: 0,
  },
  userText: { color: "white", fontSize: 16 },
  gptText: { color: "black", fontSize: 16 },
  inputContainer: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#ddd",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: "#00A652",
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
});

export default ChatGPTTab;
