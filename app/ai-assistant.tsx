/**
 * HealPoint — AI Healthcare Assistant Screen.
 *
 * A production-quality, patient-centric AI Assistant built with real backend data,
 * contextual healthcare awareness, strict patient privacy, and platform navigation.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { type Href, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Badge } from "@/components/ui/Badge";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { formatDDMMYYYY, formatDoctorName, formatINR } from "@/lib/format";
import { getDoctorImage, HOSPITAL_PLACEHOLDER } from "@/lib/image";
import {
  type AiActionConfirmation,
  type AiAppointmentCardData,
  type AiChatAction,
  type AiChatCard,
  type AiChatMessage,
  type AiDoctorCardData,
  type AiEmergencyCardData,
  type AiHospitalCardData,
  executeAiAction,
  sendAiMessage,
} from "@/services/ai";

const QUICK_PROMPTS = [
  {
    label: "Health Timeline",
    query: "Show my personal health timeline",
    icon: "time" as const,
  },
  {
    label: "Last Appointment",
    query: "What happened in my last appointment?",
    icon: "calendar" as const,
  },
  {
    label: "Follow-up Care",
    query: "Do I have any upcoming follow-up?",
    icon: "refresh" as const,
  },
  {
    label: "Recent Rx",
    query: "Show my recent prescriptions",
    icon: "document-text" as const,
  },
  {
    label: "Latest Report",
    query: "Open my latest report",
    icon: "bar-chart" as const,
  },
  {
    label: "Find a Doctor",
    query: "I want to find a doctor",
    icon: "search" as const,
  },
  {
    label: "Cardiologist",
    query: "I need a cardiologist",
    icon: "heart" as const,
  },
  {
    label: "Next Appointment",
    query: "When is my next appointment?",
    icon: "calendar" as const,
  },
  {
    label: "Find Hospitals",
    query: "Find hospitals near me",
    icon: "business" as const,
  },
  {
    label: "Video Consult",
    query: "How do I join online consultation?",
    icon: "videocam" as const,
  },
  {
    label: "Emergency Help",
    query: "Emergency medical help",
    icon: "alert-circle" as const,
  },
  {
    label: "Support",
    query: "I need support and help",
    icon: "help-buoy" as const,
  },
];

export default function AiAssistantScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(
    null,
  );
  const scrollViewRef = useRef<ScrollView>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize welcome message once
  useEffect(() => {
    const patientFirstName = user?.name ? user.name.split(" ")[0] : "there";
    const welcomeMsg: AiChatMessage = {
      id: "welcome-message",
      sender: "ai",
      text: `Hi ${patientFirstName}! 👋 I'm your HealPoint AI Healthcare Assistant.\n\nI can help you check upcoming appointments, find specialists, locate partner hospitals, access your digital prescriptions, or guide you across HealPoint. How can I assist you today?`,
      disclaimer:
        "HealPoint AI provides healthcare navigation and informational assistance only. It does not provide medical diagnosis or replace professional consultation with a certified doctor.",
      actions: [
        {
          label: "Find a Doctor",
          route: "/doctors",
          icon: "search",
          variant: "primary",
        },
        {
          label: "Health Timeline",
          route: "/health/timeline",
          icon: "time",
          variant: "secondary",
        },
        {
          label: "Upcoming Visit",
          route: "/appointments",
          icon: "calendar",
          variant: "secondary",
        },
        {
          label: "Emergency Care",
          route: "/emergency",
          icon: "alert-circle",
          variant: "danger",
        },
      ],
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages([welcomeMsg]);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [user?.name]);

  const scrollToBottom = (delay = 100) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, delay);
  };

  const handleSend = async (textToSend?: string) => {
    const rawText = textToSend ?? input;
    const query = rawText.trim();
    if (!query || isSubmitting) return;

    const userMessage: AiChatMessage = {
      id: `user-${Date.now()}-${Math.random()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSubmitting(true);
    scrollToBottom(50);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await sendAiMessage(query, controller.signal);
      const aiMessage: AiChatMessage = {
        id: `ai-${Date.now()}-${Math.random()}`,
        sender: "ai",
        text: response.reply,
        disclaimer: response.disclaimer,
        actionConfirmation: response.actionConfirmation,
        actions: response.actions,
        cards: response.cards,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const errorMsg: AiChatMessage = {
        id: `err-${Date.now()}`,
        sender: "ai",
        text:
          error instanceof Error
            ? error.message
            : "Sorry, I am having trouble connecting right now. Please check your connection and try again.",
        isError: true,
        actions: [
          {
            label: "Retry Message",
            route: "RETRY",
            icon: "refresh",
            variant: "secondary",
          },
        ],
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSubmitting(false);
      abortControllerRef.current = null;
      scrollToBottom(150);
    }
  };

  const handleActionClick = (action: AiChatAction) => {
    if (action.route === "RETRY") {
      const lastUserMsg = [...messages]
        .reverse()
        .find((m) => m.sender === "user");
      if (lastUserMsg) {
        handleSend(lastUserMsg.text);
      }
      return;
    }

    // Direct routing to existing screens
    try {
      if (action.params) {
        router.push({ pathname: action.route as never, params: action.params });
      } else {
        router.push(action.route as never);
      }
    } catch (err) {
      console.warn("[AiAssistant] Navigation failed:", err);
      router.push(action.route as never);
    }
  };

  const handleConfirmAction = async (confirmation: AiActionConfirmation) => {
    if (executingActionId) return;
    setExecutingActionId(confirmation.appointmentId);
    try {
      await executeAiAction(confirmation.action, confirmation.appointmentId);
      const successMsg: AiChatMessage = {
        id: `action-success-${Date.now()}`,
        sender: "ai",
        text: `✅ **Appointment Cancelled Successfully**\n\nYour appointment with ${confirmation.doctorName} on ${confirmation.slotDate} at ${confirmation.slotTime} has been cancelled. Your reserved slot has been released back into availability.`,
        disclaimer: "Status updated in real-time across HealPoint records.",
        actions: [
          {
            label: "Book New Appointment",
            route: "/doctors",
            icon: "calendar",
            variant: "primary",
          },
          {
            label: "My Appointments",
            route: "/appointments",
            icon: "time",
            variant: "secondary",
          },
        ],
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) =>
        prev
          .map((m) =>
            m.actionConfirmation?.appointmentId === confirmation.appointmentId
              ? { ...m, actionConfirmation: null }
              : m,
          )
          .concat(successMsg),
      );
    } catch (err) {
      const errorMsg: AiChatMessage = {
        id: `action-error-${Date.now()}`,
        sender: "ai",
        text:
          err instanceof Error
            ? err.message
            : "Failed to execute cancellation. Please try again or open My Appointments.",
        isError: true,
        actions: [
          {
            label: "Open My Appointments",
            route: "/appointments",
            icon: "calendar",
            variant: "secondary",
          },
        ],
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setExecutingActionId(null);
      scrollToBottom(150);
    }
  };

  const handleDismissAction = (confirmation: AiActionConfirmation) => {
    setMessages((prev) =>
      prev
        .map((m) =>
          m.actionConfirmation?.appointmentId === confirmation.appointmentId
            ? { ...m, actionConfirmation: null }
            : m,
        )
        .concat({
          id: `dismiss-${Date.now()}`,
          sender: "ai",
          text: `Understood! Your appointment with ${confirmation.doctorName} on ${confirmation.slotDate} at ${confirmation.slotTime} remains active and confirmed.`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }),
    );
    scrollToBottom(100);
  };

  const clearChat = () => {
    const patientFirstName = user?.name ? user.name.split(" ")[0] : "there";
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: "ai",
        text: `Chat cleared! How can I help you, ${patientFirstName}?`,
        disclaimer:
          "HealPoint AI provides healthcare navigation and informational assistance only. It is not a medical diagnosis engine.",
        actions: [
          {
            label: "Find a Doctor",
            route: "/doctors",
            icon: "search",
            variant: "primary",
          },
          {
            label: "My Appointments",
            route: "/appointments",
            icon: "calendar",
            variant: "secondary",
          },
        ],
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={22} color={Palette.text} />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="sparkles" size={18} color="#0284C7" />
            <Text style={styles.headerTitle}>HealPoint AI</Text>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Online</Text>
            </View>
          </View>
          <Text style={styles.headerSub}>Care Navigation & Assistant</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear conversation"
          onPress={clearChat}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
        >
          <Ionicons name="trash-outline" size={20} color={Palette.textMuted} />
        </Pressable>
      </View>

      {/* Main Messages & Quick Actions */}
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Quick Suggestions Carousel */}
          <View style={styles.quickChipsSection}>
            <Text style={styles.quickChipsTitle}>Suggested Actions</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickChipsRow}
            >
              {QUICK_PROMPTS.map((prompt, idx) => (
                <Pressable
                  key={idx}
                  accessibilityRole="button"
                  accessibilityLabel={prompt.label}
                  disabled={isSubmitting}
                  onPress={() => handleSend(prompt.query)}
                  style={({ pressed }) => [
                    styles.quickChip,
                    pressed && styles.pressed,
                    isSubmitting && styles.disabled,
                  ]}
                >
                  <Ionicons name={prompt.icon} size={15} color="#0284C7" />
                  <Text style={styles.quickChipText}>{prompt.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Messages Stream */}
          {messages.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              onActionPress={handleActionClick}
              onConfirmAction={handleConfirmAction}
              onDismissAction={handleDismissAction}
              isExecutingAction={
                executingActionId === msg.actionConfirmation?.appointmentId
              }
            />
          ))}

          {/* Thinking / Submitting State */}
          {isSubmitting && (
            <View style={styles.thinkingContainer}>
              <View style={styles.aiAvatar}>
                <Ionicons name="sparkles" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.thinkingBubble}>
                <ActivityIndicator size="small" color="#0284C7" />
                <Text style={styles.thinkingText}>
                  HealPoint AI is analyzing...
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input Bar */}
        <View style={styles.inputArea}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.textInput}
              placeholder="Ask HealPoint AI (e.g. Find a cardiologist)..."
              placeholderTextColor="#94A3B8"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
              multiline={false}
              editable={!isSubmitting}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              onPress={() => handleSend()}
              disabled={!input.trim() || isSubmitting}
              style={({ pressed }) => [
                styles.sendBtn,
                (!input.trim() || isSubmitting) && styles.sendBtnDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="arrow-up"
                size={20}
                color={!input.trim() || isSubmitting ? "#94A3B8" : "#FFFFFF"}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Message Item Component
// ---------------------------------------------------------------------------
interface MessageItemProps {
  message: AiChatMessage;
  onActionPress: (action: AiChatAction) => void;
  onConfirmAction?: (confirmation: AiActionConfirmation) => void;
  onDismissAction?: (confirmation: AiActionConfirmation) => void;
  isExecutingAction?: boolean;
}

function MessageItem({
  message,
  onActionPress,
  onConfirmAction,
  onDismissAction,
  isExecutingAction,
}: MessageItemProps) {
  const router = useRouter();
  const isUser = message.sender === "user";

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.text}</Text>
          <Text style={styles.userTime}>{message.timestamp}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.aiRow}>
      <View style={styles.aiAvatar}>
        <Ionicons name="sparkles" size={16} color="#FFFFFF" />
      </View>

      <View style={styles.aiContentWrap}>
        <View
          style={[styles.aiBubble, message.isError && styles.aiBubbleError]}
        >
          <Text style={styles.aiText}>{message.text}</Text>

          {/* Action Confirmation Card (Cancellation, etc.) */}
          {message.actionConfirmation && (
            <View style={styles.confirmationCard}>
              <View style={styles.confirmHeader}>
                <View style={styles.confirmIconWrap}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                </View>
                <View style={styles.confirmHeaderTexts}>
                  <Text style={styles.confirmTitle}>Confirm Cancellation</Text>
                  <Text style={styles.confirmSubtitle}>
                    This action will release your appointment slot
                  </Text>
                </View>
              </View>

              <View style={styles.confirmDetailsBox}>
                <View style={styles.confirmDetailRow}>
                  <Ionicons name="person" size={14} color="#0284C7" />
                  <Text style={styles.confirmDetailText}>
                    {message.actionConfirmation.doctorName} (
                    {message.actionConfirmation.speciality || "Specialist"})
                  </Text>
                </View>
                <View style={styles.confirmDetailRow}>
                  <Ionicons name="calendar" size={14} color="#0284C7" />
                  <Text style={styles.confirmDetailText}>
                    {message.actionConfirmation.slotDate} at{" "}
                    {message.actionConfirmation.slotTime}
                  </Text>
                </View>
                <View style={styles.confirmDetailRow}>
                  <Ionicons name="business" size={14} color="#0284C7" />
                  <Text style={styles.confirmDetailText} numberOfLines={1}>
                    {message.actionConfirmation.hospitalName ||
                      "HealPoint Partner Hospital"}
                  </Text>
                </View>
              </View>

              <View style={styles.confirmBtnRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Confirm Cancellation"
                  disabled={isExecutingAction}
                  onPress={() => onConfirmAction?.(message.actionConfirmation!)}
                  style={({ pressed }) => [
                    styles.confirmBtnDanger,
                    isExecutingAction && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {isExecutingAction ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="trash-bin" size={15} color="#FFFFFF" />
                      <Text style={styles.confirmBtnDangerText}>
                        Confirm Cancellation
                      </Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Keep Appointment"
                  disabled={isExecutingAction}
                  onPress={() => onDismissAction?.(message.actionConfirmation!)}
                  style={({ pressed }) => [
                    styles.confirmBtnKeep,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.confirmBtnKeepText}>
                    Keep Appointment
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Cards (Appointments, Doctors, Hospitals, Emergency) */}
          {message.cards && message.cards.length > 0 && (
            <View style={styles.cardsWrap}>
              {message.cards.map((card, idx) => (
                <DataCardItem key={idx} card={card} />
              ))}
            </View>
          )}

          {/* Quick Navigation Action Buttons */}
          {message.actions && message.actions.length > 0 && (
            <View style={styles.actionsWrap}>
              {message.actions.map((act, idx) => {
                const isDanger = act.variant === "danger";
                const isPrimary = act.variant === "primary";
                return (
                  <Pressable
                    key={idx}
                    accessibilityRole="button"
                    accessibilityLabel={act.label}
                    onPress={() => onActionPress(act)}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      isPrimary && styles.actionBtnPrimary,
                      isDanger && styles.actionBtnDanger,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name={
                        (act.icon as keyof typeof Ionicons.glyphMap) ||
                        "arrow-forward"
                      }
                      size={15}
                      color={
                        isDanger ? "#DC2626" : isPrimary ? "#FFFFFF" : "#0284C7"
                      }
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        isPrimary && styles.actionBtnTextPrimary,
                        isDanger && styles.actionBtnTextDanger,
                      ]}
                    >
                      {act.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Disclaimer Pill */}
          {message.disclaimer && (
            <View style={styles.disclaimerBox}>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color="#64748B"
              />
              <Text style={styles.disclaimerText}>{message.disclaimer}</Text>
            </View>
          )}

          <Text style={styles.aiTime}>{message.timestamp}</Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Embedded Data Card Renderer
// ---------------------------------------------------------------------------
function DataCardItem({ card }: { card: AiChatCard }) {
  const router = useRouter();

  if (card.type === "appointment") {
    const data = card.data as AiAppointmentCardData;
    const isVideo = data.consultationType === "video";
    return (
      <View style={styles.cardContainer}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconBox}>
            <Ionicons name="calendar" size={18} color="#0284C7" />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>
              {data.doctorName || "Doctor Appointment"}
            </Text>
            <Text style={styles.cardSubtitle}>
              {data.speciality || "Specialist"}
            </Text>
          </View>
          <Badge
            variant={data.status === "confirmed" ? "success" : "warning"}
            label={data.status || "Pending"}
          />
        </View>

        <View style={styles.cardDetailsGrid}>
          <View style={styles.cardDetailRow}>
            <Ionicons name="time-outline" size={14} color="#64748B" />
            <Text style={styles.cardDetailText}>
              {formatDDMMYYYY(data.slotDate)} • {data.slotTime}
            </Text>
          </View>
          <View style={styles.cardDetailRow}>
            <Ionicons name="business-outline" size={14} color="#64748B" />
            <Text style={styles.cardDetailText} numberOfLines={1}>
              {data.hospitalName || "HealPoint Hospital"}
            </Text>
          </View>
          <View style={styles.cardDetailRow}>
            <Ionicons
              name={isVideo ? "videocam-outline" : "medkit-outline"}
              size={14}
              color={isVideo ? "#9356D6" : "#0E9F8E"}
            />
            <Text style={styles.cardDetailText}>
              {isVideo ? "Online Video Consult" : "In-Clinic Visit"}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View appointment"
          onPress={() =>
            router.push({
              pathname: "/appointment/[id]",
              params: { id: data._id },
            })
          }
          style={({ pressed }) => [
            styles.cardCtaBtn,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.cardCtaText}>View Appointment</Text>
          <Ionicons name="chevron-forward" size={14} color="#0284C7" />
        </Pressable>
      </View>
    );
  }

  if (card.type === "doctor") {
    const data = card.data as AiDoctorCardData;
    const rating = Number(data.rating || 4.8).toFixed(1);
    const feesFormatted = formatINR(data.fees || 500);

    return (
      <View style={styles.cardContainer}>
        <View style={styles.cardHeader}>
          <Image
            source={{ uri: getDoctorImage(data as never, 0) }}
            style={styles.cardDoctorAvatar}
            contentFit="cover"
          />
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>{formatDoctorName(data.name)}</Text>
            <Text style={styles.cardSubtitle}>
              {data.specialization || data.speciality || "General Specialist"}
            </Text>
            <Text style={styles.cardHospitalText} numberOfLines={1}>
              {data.hospitalName || "HealPoint Partner"}
            </Text>
          </View>
        </View>

        <View style={styles.doctorStatsRow}>
          <View style={styles.statPill}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={styles.statPillText}>{rating}</Text>
          </View>
          <View style={styles.statPill}>
            <Ionicons name="briefcase-outline" size={12} color="#64748B" />
            <Text style={styles.statPillText}>{data.experience || 5}+ yrs</Text>
          </View>
          <View style={styles.statPill}>
            <Ionicons name="cash-outline" size={12} color="#10B981" />
            <Text style={styles.statPillText}>{feesFormatted}</Text>
          </View>
        </View>

        <View style={styles.cardActionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View doctor profile"
            onPress={() =>
              router.push({
                pathname: "/doctor/[id]",
                params: { id: data._id },
              })
            }
            style={({ pressed }) => [
              styles.cardCtaSecondary,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.cardCtaSecondaryText}>Profile</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Book appointment"
            onPress={() =>
              router.push({
                pathname: "/booking/[doctorId]",
                params: { doctorId: data._id },
              })
            }
            style={({ pressed }) => [
              styles.cardCtaPrimary,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.cardCtaPrimaryText}>Book Visit</Text>
            <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    );
  }

  if (card.type === "hospital") {
    const data = card.data as AiHospitalCardData;
    return (
      <View style={styles.cardContainer}>
        <View style={styles.cardHeader}>
          <Image
            source={data.image ? { uri: data.image } : HOSPITAL_PLACEHOLDER}
            style={styles.cardHospitalImage}
            contentFit="cover"
          />
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>{data.name}</Text>
            <Text style={styles.cardSubtitle}>
              {data.city || "Multi-Specialty Hospital"}
            </Text>
            {data.phone ? (
              <Text style={styles.cardHospitalPhone}>📞 {data.phone}</Text>
            ) : null}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View hospital details"
          onPress={() =>
            router.push({
              pathname: "/hospital/[id]",
              params: { id: data._id },
            })
          }
          style={({ pressed }) => [
            styles.cardCtaBtn,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.cardCtaText}>View Hospital Details</Text>
          <Ionicons name="chevron-forward" size={14} color="#0284C7" />
        </Pressable>
      </View>
    );
  }

  if (card.type === "emergency") {
    const data = card.data as AiEmergencyCardData;
    return (
      <View style={[styles.cardContainer, styles.emergencyCard]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconBox, styles.emergencyIconBox]}>
            <Ionicons name="alert-circle" size={20} color="#DC2626" />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.emergencyTitle}>{data.title}</Text>
            <Text style={styles.emergencyDesc}>{data.description}</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Emergency Services"
          onPress={() => router.push("/emergency")}
          style={({ pressed }) => [
            styles.emergencyBtn,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="call" size={15} color="#FFFFFF" />
          <Text style={styles.emergencyBtnText}>Open Emergency Assistance</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    ...Shadows.sm,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  headerTitleWrap: {
    alignItems: "center",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  headerSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    gap: 4,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  liveText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#059669",
  },
  keyboardContainer: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  quickChipsSection: {
    marginBottom: Spacing.md,
  },
  quickChipsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quickChipsRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "#E0F2FE",
    gap: 6,
    ...Shadows.sm,
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#0369A1",
  },
  userRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginVertical: 6,
  },
  userBubble: {
    maxWidth: "82%",
    backgroundColor: "#0284C7",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    ...Shadows.sm,
  },
  userText: {
    fontSize: 15,
    color: "#FFFFFF",
    lineHeight: 20,
  },
  userTime: {
    fontSize: 10,
    color: "rgba(255,255,255,0.75)",
    alignSelf: "flex-end",
    marginTop: 4,
  },
  aiRow: {
    flexDirection: "row",
    marginVertical: 8,
    alignItems: "flex-start",
    gap: 10,
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    backgroundColor: "#0284C7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    ...Shadows.sm,
  },
  aiContentWrap: {
    flex: 1,
  },
  aiBubble: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...Shadows.sm,
  },
  aiBubbleError: {
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  aiText: {
    fontSize: 15,
    color: "#1E293B",
    lineHeight: 22,
  },
  aiTime: {
    fontSize: 10,
    color: "#94A3B8",
    alignSelf: "flex-start",
    marginTop: 6,
  },
  cardsWrap: {
    marginTop: 10,
    gap: 10,
  },
  cardContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginTop: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  cardDoctorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E2E8F0",
  },
  cardHospitalImage: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#0284C7",
    marginTop: 1,
  },
  cardHospitalText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  cardHospitalPhone: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "500",
    marginTop: 2,
  },
  cardDetailsGrid: {
    marginTop: 10,
    gap: 4,
  },
  cardDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardDetailText: {
    fontSize: 12,
    color: "#475569",
  },
  doctorStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 4,
  },
  statPillText: {
    fontSize: 11,
    color: "#334155",
    fontWeight: "500",
  },
  cardActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  cardCtaSecondary: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  cardCtaSecondaryText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  cardCtaPrimary: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#0284C7",
    gap: 4,
  },
  cardCtaPrimaryText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  cardCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  cardCtaText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0369A1",
  },
  emergencyCard: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  emergencyIconBox: {
    backgroundColor: "#FEE2E2",
  },
  emergencyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#B91C1C",
  },
  emergencyDesc: {
    fontSize: 12,
    color: "#7F1D1D",
    marginTop: 2,
  },
  emergencyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    marginTop: 10,
  },
  emergencyBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  actionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    gap: 6,
  },
  actionBtnPrimary: {
    backgroundColor: "#0284C7",
    borderColor: "#0284C7",
  },
  actionBtnDanger: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0284C7",
  },
  actionBtnTextPrimary: {
    color: "#FFFFFF",
  },
  actionBtnTextDanger: {
    color: "#DC2626",
  },
  disclaimerBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    marginTop: 10,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: "#64748B",
    lineHeight: 15,
  },
  thinkingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 8,
  },
  thinkingBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
    ...Shadows.sm,
  },
  thinkingText: {
    fontSize: 13,
    color: "#64748B",
  },
  inputArea: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 8 : 4,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: "#0F172A",
    paddingVertical: 4,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#0284C7",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#E2E8F0",
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
  confirmationCard: {
    marginTop: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: "#FECACA",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  confirmHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  confirmIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmHeaderTexts: {
    flex: 1,
  },
  confirmTitle: {
    ...Typography.h4,
    fontWeight: "700",
    color: "#991B1B",
  },
  confirmSubtitle: {
    ...Typography.caption,
    color: "#DC2626",
  },
  confirmDetailsBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: "#FEE2E2",
    gap: 4,
  },
  confirmDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  confirmDetailText: {
    ...Typography.caption,
    fontWeight: "600",
    color: "#334155",
    flex: 1,
  },
  confirmBtnRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: 4,
  },
  confirmBtnDanger: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#DC2626",
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  confirmBtnDangerText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  confirmBtnKeep: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  confirmBtnKeepText: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 13,
  },
});
