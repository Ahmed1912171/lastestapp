import axios from "axios";
import React, { useEffect, useRef, useState } from "react";
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

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

const BACKEND_BASE = "http://192.168.100.147:3000";
const HARDCODED_PATIENT_ID = "25902403";

const AIChatModal: React.FC<Props> = ({ visible, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Fetch patient info + AI analysis when modal opens
  useEffect(() => {
    if (!visible) return;

    const fetchPatientAnalysis = async () => {
      setLoading(true);
      try {
        const resp = await axios.get(
          `${BACKEND_BASE}/patients/${HARDCODED_PATIENT_ID}/full-analysis`
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
      } catch (err: any) {
        const errorMsg: Message = {
          id: Date.now().toString() + "_error",
          role: "assistant",
          content:
            "⚠️ Failed to fetch patient analysis. Check backend connection.",
        };
        setMessages([errorMsg]);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientAnalysis();
  }, [visible]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // User sending message (optional chat functionality)
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
          "⚠️ Cannot reach server or OpenAI failed. Check your backend connection.",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        {/* Background dismiss */}
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

            {/* Chat Area */}
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
                  {item.role === "assistant" ? (
                    <>
                      {item.content
                        .split("\n")
                        .map(
                          (
                            line:
                              | string
                              | number
                              | bigint
                              | boolean
                              | React.ReactElement<
                                  unknown,
                                  string | React.JSXElementConstructor<any>
                                >
                              | Iterable<React.ReactNode>
                              | React.ReactPortal
                              | Promise<
                                  | string
                                  | number
                                  | bigint
                                  | boolean
                                  | React.ReactPortal
                                  | React.ReactElement<
                                      unknown,
                                      string | React.JSXElementConstructor<any>
                                    >
                                  | Iterable<React.ReactNode>
                                  | null
                                  | undefined
                                >
                              | null
                              | undefined,
                            idx: React.Key | null | undefined
                          ) => (
                            <Text key={idx} style={styles.gptText}>
                              {line}
                            </Text>
                          )
                        )}
                    </>
                  ) : (
                    <Text style={styles.userText}>{item.content}</Text>
                  )}
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

            {/* Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="Ask me anything..."
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
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  keyboardView: {
    width: "90%",
    height: "70%",
  },
  modal: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#00A652",
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
    backgroundColor: "#00A652",
    alignSelf: "flex-end",
    borderTopRightRadius: 0,
  },
  gptBubble: {
    backgroundColor: "#e5e5ea",
    alignSelf: "flex-start",
    borderTopLeftRadius: 0,
  },
  userText: { color: "white", fontSize: 15 },
  gptText: { color: "black", fontSize: 15, lineHeight: 20 },
  inputContainer: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fafafa",
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

export default AIChatModal;
