import axios from "axios";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { useTheme } from "../ctx/theme";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  patientId?: number | null;
}

const BACKEND_BASE = "http://192.168.100.134:3000";

type ThemePalette = ReturnType<typeof useTheme>["palette"];

const AIChatModal: React.FC<Props> = ({ visible, onClose, patientId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const { isDarkMode, palette } = useTheme();
  const styles = useMemo(() => createStyles(palette, isDarkMode), [palette, isDarkMode]);

  // ⚡ Fetch patient analysis only when modal opens (with a valid patientId)
  useEffect(() => {
    if (!visible || !patientId) return;

    const fetchPatientAnalysis = async () => {
      setLoading(true);
      setMessages([]); // clear old messages if any
      try {
        const resp = await axios.get(
          `${BACKEND_BASE}/patients/${patientId}/full-analysis`
        );

        const patient = resp.data.patient;
        const analysisText = resp.data.analysis;

        const analysisMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: `
🧑‍⚕️ Patient Information
------------------------
Name: ${patient.PATIENT_FNAME} ${patient.PATIENT_LNAME}
Age: ${patient.AGE}
Gender: ${patient.GENDER}
Patient ID: ${patient.PATIENT_ID}

🧪 AI Analysis
------------------------
${analysisText}
          `.trim(),
        };

        setMessages([analysisMessage]);
      } catch (err) {
        const errorMsg: Message = {
          id: Date.now().toString() + "_error",
          role: "assistant",
          content:
            "⚠️ Failed to fetch patient analysis. Please check backend connection.",
        };
        setMessages([errorMsg]);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientAnalysis();
  }, [visible, patientId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // 💬 Send message manually (optional chat functionality)
  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const resp = await axios.post(`${BACKEND_BASE}/chat`, {
        messages: [...messages, userMessage],
        patientId: patientId ?? null,
      });

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
    } catch (err) {
      const errorMsg: Message = {
        id: Date.now().toString() + "_error",
        role: "assistant",
        content:
          "⚠️ Could not connect to server. Please check backend connection.",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerText}>💬 SICHN AI</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.close}>✖</Text>
              </TouchableOpacity>
            </View>

            {/* Chat List */}
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              style={styles.chatList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.messageContainer,
                    item.role === "user" ? styles.userBubble : styles.gptBubble,
                  ]}
                >
                  <Text
                    style={
                      item.role === "user" ? styles.userText : styles.gptText
                    }
                  >
                    {item.content}
                  </Text>
                </View>
              )}
            />

            {loading && (
              <ActivityIndicator
                style={{ paddingVertical: 6 }}
                size="small"
                color="#00A652"
              />
            )}

            {/* Input Section */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="Ask something..."
                multiline
              />
              <TouchableOpacity
                style={styles.sendButton}
                onPress={sendMessage}
                disabled={loading}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const createStyles = (palette: ThemePalette, isDarkMode: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: isDarkMode ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
    },
    keyboardView: {
      width: "90%",
      height: "70%",
    },
    modal: {
      flex: 1,
      backgroundColor: palette.card ?? "#fff",
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: palette.border ?? "#e5e7eb",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: palette.primary ?? "#00A652",
      padding: 15,
    },
    headerText: {
      color: "#fff",
      fontWeight: "bold",
      fontSize: 16,
    },
    close: {
      color: "#fff",
      fontSize: 18,
    },
    chatList: {
      flex: 1,
      paddingHorizontal: 10,
    },
    messageContainer: {
      marginVertical: 5,
      padding: 10,
      borderRadius: 12,
      maxWidth: "80%",
    },
    userBubble: {
      backgroundColor: palette.primary ?? "#00A652",
      alignSelf: "flex-end",
      borderTopRightRadius: 0,
    },
    gptBubble: {
      backgroundColor: palette.surface ?? (isDarkMode ? "#111111" : "#e5e5ea"),
      alignSelf: "flex-start",
      borderTopLeftRadius: 0,
    },
    userText: { color: "#fff", fontSize: 15 },
    gptText: {
      color: palette.text ?? "#111",
      fontSize: 15,
      lineHeight: 20,
    },
    inputContainer: {
      flexDirection: "row",
      padding: 10,
      borderTopWidth: 1,
      borderColor: palette.border ?? "#ddd",
      backgroundColor: palette.surface ?? "#fafafa",
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: palette.border ?? "#ccc",
      borderRadius: 20,
      paddingHorizontal: 15,
      paddingVertical: 10,
      marginRight: 10,
      maxHeight: 100,
      color: palette.text ?? "#111",
    },
    sendButton: {
      backgroundColor: palette.primary ?? "#00A652",
      borderRadius: 20,
      paddingHorizontal: 20,
      justifyContent: "center",
    },
    sendButtonText: { color: "#fff", fontWeight: "bold" },
  });

export default AIChatModal;
