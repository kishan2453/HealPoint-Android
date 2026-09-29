import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { DrawerHeader } from "@/components/drawer/DrawerHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import * as supportService from "@/services/support";
import type {
  SupportTicket,
  SupportTicketCategory,
  SupportTicketStatus,
} from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type SupportOption = {
  label: string;
  detail: string;
  actionText: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  badge?: string;
};

const CHANNELS: SupportOption[] = [
  {
    label: "24×7 Care Helpline",
    detail: "Speak directly with our dedicated healthcare support coordinator.",
    actionText: "Call Helpline",
    icon: "call",
    href: "tel:+919810000000",
    badge: "Toll-Free",
  },
  {
    label: "Email Support Team",
    detail:
      "Send clinical documentation or detailed inquiries (replies within 24h).",
    actionText: "Send Email",
    icon: "mail",
    href: "mailto:support@healpoint.app?subject=HealPoint%20Healthcare%20Support",
    badge: "24h Response",
  },
  {
    label: "Hospital & Clinic Centers",
    detail: "Visit our flagship healthcare centers and partner hospital desks.",
    actionText: "Open Directions",
    icon: "location",
    href: "https://maps.google.com/?q=HealPoint+Healthcare",
  },
];

type Faq = { category: string; question: string; answer: string };

const FAQS: Faq[] = [
  {
    category: "Appointments",
    question: "How do I book an appointment with a doctor?",
    answer:
      'Open "Find Doctors" from the main menu, browse by medical specialty or hospital, select an available date and time slot, and tap "Book Appointment". You can confirm payment securely online with instant confirmation.',
  },
  {
    category: "Appointments",
    question: "Can I reschedule or cancel a booked appointment?",
    answer:
      'Yes. Navigate to "My Appointments" from the drawer, select your booking, and tap "Reschedule" or "Cancel Appointment". You can choose another slot or receive a refund according to provider cancellation policies.',
  },
  {
    category: "Medical Records",
    question: "Where can I access my digital prescriptions and lab reports?",
    answer:
      'Open "Health Records" from the menu. All electronic prescriptions signed by your consulting doctors and diagnostic test summaries are securely stored and available for instant viewing and PDF sharing.',
  },
  {
    category: "Billing",
    question: "How does online payment with Razorpay work?",
    answer:
      "HealPoint uses RBI-compliant Razorpay with 256-bit encryption. We support UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, and Net Banking. Your receipt is generated immediately upon payment.",
  },
  {
    category: "Security",
    question:
      "How is my medical data and personal health information protected?",
    answer:
      "Your health records are stored with end-to-end encryption complying with healthcare privacy standards. Only you and the licensed medical practitioners you consult with have authorized access to your records.",
  },
  {
    category: "Family Care",
    question: "Can I book appointments and manage records for family members?",
    answer:
      'Yes. Go to "Family Members" under Health in the drawer menu. You can add dependent profiles (children, parents, spouse) and schedule appointments under their name seamlessly.',
  },
];

const CATEGORY_OPTIONS: { label: string; value: SupportTicketCategory }[] = [
  { label: "Appointment", value: "APPOINTMENT_BOOKING" },
  { label: "Cancellation", value: "APPOINTMENT_CANCELLATION" },
  { label: "Payment / Billing", value: "PAYMENT_BILLING" },
  { label: "Refund", value: "REFUND_REQUEST" },
  { label: "Subscription", value: "SUBSCRIPTION_BENEFITS" },
  { label: "Online Consultation", value: "ONLINE_CONSULTATION" },
  { label: "Prescription / Report", value: "PRESCRIPTION_REPORTS" },
  { label: "Queue / Check-In", value: "QUEUE_CHECKIN" },
  { label: "Account & Security", value: "SECURITY_ACCESS" },
  { label: "General Enquiry", value: "GENERAL_ENQUIRY" },
  { label: "Complaint", value: "COMPLAINT" },
];

function statusVariant(
  s: SupportTicketStatus,
): "primary" | "success" | "warning" | "error" | "neutral" {
  if (s === "OPEN" || s === "TRIAGED") return "warning";
  if (s === "ASSIGNED" || s === "IN_PROGRESS") return "primary";
  if (s === "ESCALATED") return "error";
  if (s === "RESOLVED" || s === "CLOSED") return "success";
  return "neutral";
}

function statusLabel(s: SupportTicketStatus): string {
  const map: Record<SupportTicketStatus, string> = {
    OPEN: "Open",
    TRIAGED: "Triaged",
    ASSIGNED: "Assigned",
    IN_PROGRESS: "In Progress",
    WAITING_FOR_PATIENT: "Awaiting You",
    WAITING_FOR_HOSPITAL: "Awaiting Hospital",
    ESCALATED: "Escalated",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
  };
  return map[s] ?? s;
}

// ---------------------------------------------------------------------------
// Ticket Detail Modal
// ---------------------------------------------------------------------------
function TicketDetailModal({
  ticket,
  visible,
  onClose,
  onReply,
}: {
  ticket: SupportTicket | null;
  visible: boolean;
  onClose: () => void;
  onReply: (ticketId: string, body: string) => Promise<void>;
}) {
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const { user } = useAuth();

  const handleSendReply = async () => {
    if (!ticket || !replyBody.trim()) return;
    setSending(true);
    try {
      await onReply(ticket._id, replyBody.trim());
      setReplyBody("");
    } finally {
      setSending(false);
    }
  };

  if (!ticket) return null;

  const canReply = !["RESOLVED", "CLOSED"].includes(ticket.status);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle} numberOfLines={2}>
              {ticket.subject}
            </Text>
            <Text style={styles.modalTicketNum}>{ticket.ticketNumber}</Text>
          </View>
          <Badge
            label={statusLabel(ticket.status)}
            variant={statusVariant(ticket.status)}
          />
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={Palette.text} />
          </Pressable>
        </View>

        {/* Messages */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
        >
          {ticket.messages.map((msg, i) => {
            const isPatient = msg.sender.role === "patient";
            return (
              <View
                key={msg._id ?? i}
                style={[
                  styles.msgBubble,
                  isPatient ? styles.msgBubbleRight : styles.msgBubbleLeft,
                ]}
              >
                <Text style={styles.msgSenderName}>{msg.sender.name}</Text>
                <Text
                  style={[
                    styles.msgBody,
                    isPatient ? styles.msgBodyRight : styles.msgBodyLeft,
                  ]}
                >
                  {msg.body}
                </Text>
                <Text style={styles.msgTime}>
                  {new Date(msg.sentAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            );
          })}
          {ticket.messages.length === 0 && (
            <Text style={styles.noMessages}>No messages yet.</Text>
          )}
        </ScrollView>

        {/* Reply box */}
        {canReply && (
          <View style={styles.replyBox}>
            <TextInput
              value={replyBody}
              onChangeText={setReplyBody}
              placeholder="Type your reply…"
              placeholderTextColor={Palette.textMuted}
              multiline
              style={styles.replyInput}
            />
            <Button
              title="Send"
              onPress={handleSendReply}
              loading={sending}
              fullWidth={false}
              style={{ alignSelf: "flex-end" }}
            />
          </View>
        )}
        {!canReply && (
          <View style={styles.resolvedNotice}>
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={Palette.success}
            />
            <Text style={styles.resolvedNoticeText}>
              This ticket has been {statusLabel(ticket.status).toLowerCase()}.
              Open a new request if you need further help.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// My Tickets Tab
// ---------------------------------------------------------------------------
function MyTicketsTab() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null,
  );
  const [detailVisible, setDetailVisible] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      setError("");
      const res = await supportService.getMyTickets({ limit: 30 });
      setTickets(res.tickets ?? []);
    } catch {
      setError("Could not load tickets. Please try again.");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchTickets().finally(() => setLoading(false));
  }, [fetchTickets]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTickets();
    setRefreshing(false);
  }, [fetchTickets]);

  const openTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setDetailVisible(true);
  };

  const handleReply = async (ticketId: string, body: string) => {
    await supportService.postMessage(ticketId, { body });
    // Refresh selected ticket
    try {
      const res = await supportService.getTicketById(ticketId);
      setSelectedTicket(res.ticket);
      setTickets((prev) =>
        prev.map((t) => (t._id === ticketId ? res.ticket : t)),
      );
    } catch {}
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Palette.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Button
          title="Retry"
          variant="outline"
          onPress={() => {
            setLoading(true);
            fetchTickets().finally(() => setLoading(false));
          }}
          fullWidth={false}
        />
      </View>
    );
  }

  if (tickets.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="headset-outline" size={40} color={Palette.textMuted} />
        <Text style={styles.emptyTitle}>No support tickets yet</Text>
        <Text style={styles.emptySubtitle}>
          If you need help, raise a request using the "Send Request" tab.
        </Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={tickets}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Palette.primary}
          />
        }
        contentContainerStyle={styles.ticketList}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openTicket(item)}
            style={({ pressed }) => [
              styles.ticketCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.ticketCardHeader}>
              <Text style={styles.ticketNum}>{item.ticketNumber}</Text>
              <Badge
                label={statusLabel(item.status)}
                variant={statusVariant(item.status)}
              />
            </View>
            <Text style={styles.ticketSubject} numberOfLines={2}>
              {item.subject}
            </Text>
            <View style={styles.ticketMeta}>
              <Text style={styles.ticketCategory}>
                {CATEGORY_OPTIONS.find((c) => c.value === item.category)
                  ?.label ?? item.category}
              </Text>
              <Text style={styles.ticketDate}>
                {new Date(item.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </Text>
            </View>
            {item.messages.length > 0 && (
              <Text style={styles.ticketLastMsg} numberOfLines={1}>
                Last: {item.messages[item.messages.length - 1].body}
              </Text>
            )}
          </Pressable>
        )}
      />
      <TicketDetailModal
        ticket={selectedTicket}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onReply={handleReply}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------
export default function SupportScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    tab?: string;
    type?: string;
    appointmentId?: string;
  }>();

  const [activeTab, setActiveTab] = useState<"send" | "my-tickets">(
    params.tab === "my-tickets" ? "my-tickets" : "send",
  );
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const defaultCategory = (params.type ??
    "GENERAL_ENQUIRY") as SupportTicketCategory;
  const [selectedCategory, setSelectedCategory] =
    useState<SupportTicketCategory>(defaultCategory);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState<string>("");
  const [formError, setFormError] = useState("");

  const openOption = (href: string) => {
    Linking.openURL(href).catch(() => undefined);
  };

  const toggleFaq = (question: string) => {
    setOpenFaq((current) => (current === question ? null : question));
  };

  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.filter(
      (faq) =>
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q) ||
        faq.category.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const handleSubmitTicket = async () => {
    setFormError("");
    if (!subject.trim()) {
      setFormError("Please enter a subject for your message.");
      return;
    }
    if (!message.trim()) {
      setFormError("Please describe how our care team can help you.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        subject: subject.trim(),
        body: message.trim(),
        category: selectedCategory,
      };
      if (params.appointmentId) {
        payload.appointmentId = params.appointmentId;
      }
      const res = await supportService.createTicket(payload);
      setTicketSuccess(res.ticket?.ticketNumber ?? "TKT-SUBMITTED");
      setSubject("");
      setMessage("");
    } catch (err: any) {
      setFormError(
        err?.response?.data?.message ??
          "Failed to submit ticket. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.safe}>
      <DrawerHeader
        title="Help & Support"
        subtitle="24×7 Healthcare assistance & guides"
      />

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(
          [
            { id: "send", label: "Send Request", icon: "chatbubbles-outline" },
            {
              id: "my-tickets",
              label: "My Tickets",
              icon: "list-outline",
            },
          ] as const
        ).map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={[styles.tabItem, activeTab === tab.id && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.id }}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === tab.id ? Palette.primary : Palette.textMuted}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.id && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === "my-tickets" ? (
        <MyTicketsTab />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Emergency Medical Alert Banner */}
          <View style={styles.emergencyBanner}>
            <View style={styles.emergencyIconWrap}>
              <Ionicons name="medical" size={20} color={Palette.white} />
            </View>
            <View style={styles.emergencyTexts}>
              <Text style={styles.emergencyTitle}>Medical Emergency?</Text>
              <Text style={styles.emergencyBody}>
                For critical or life-threatening emergencies, immediately call
                national emergency dispatch (108 / 112) or go to the nearest
                emergency ward.
              </Text>
            </View>
          </View>

          {/* Support Channels Grid */}
          <View style={styles.channelList}>
            {CHANNELS.map((option) => (
              <Card key={option.label} padded style={styles.channelCard}>
                <View style={styles.channelRow}>
                  <View style={styles.channelIcon}>
                    <Ionicons
                      name={option.icon}
                      size={22}
                      color={Palette.primary}
                    />
                  </View>
                  <View style={styles.channelTexts}>
                    <View style={styles.channelTitleRow}>
                      <Text style={styles.channelLabel}>{option.label}</Text>
                      {option.badge ? (
                        <View style={styles.badgePill}>
                          <Text style={styles.badgeText}>{option.badge}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.channelDetail}>{option.detail}</Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  onPress={() => openOption(option.href)}
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.actionButtonText}>
                    {option.actionText}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color={Palette.primaryDark}
                  />
                </Pressable>
              </Card>
            ))}
          </View>

          {/* Support Request Form */}
          <Card style={styles.formCard}>
            <View style={styles.formHeader}>
              <Ionicons
                name="chatbubbles-outline"
                size={20}
                color={Palette.primary}
              />
              <View style={styles.formHeaderTexts}>
                <Text style={styles.formTitle}>Send a Support Request</Text>
                <Text style={styles.formSubtitle}>
                  Our care coordination team will respond within 24 hours.
                </Text>
              </View>
            </View>

            {ticketSuccess ? (
              <View style={styles.ticketSuccessCard}>
                <Ionicons
                  name="checkmark-circle"
                  size={26}
                  color={Palette.success}
                />
                <View style={styles.ticketSuccessTexts}>
                  <Text style={styles.ticketSuccessTitle}>
                    Request Submitted Successfully
                  </Text>
                  <Text style={styles.ticketSuccessBody}>
                    Ticket ID:{" "}
                    <Text style={styles.ticketBold}>{ticketSuccess}</Text>
                  </Text>
                  <Text style={styles.ticketSuccessSub}>
                    A confirmation has been recorded for{" "}
                    {user?.email || "your account"}. A care coordinator will
                    review your request shortly.
                  </Text>
                </View>
                <View style={styles.successActions}>
                  <Button
                    title="Send Another"
                    variant="outline"
                    onPress={() => setTicketSuccess("")}
                    fullWidth={false}
                  />
                  <Button
                    title="My Tickets"
                    onPress={() => setActiveTab("my-tickets")}
                    fullWidth={false}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.formFields}>
                {formError ? (
                  <FormMessage type="error" message={formError} />
                ) : null}

                {/* Category Selector */}
                <Text style={styles.inputLabel}>Select Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.topicsRow}
                >
                  {CATEGORY_OPTIONS.map((cat) => {
                    const active = selectedCategory === cat.value;
                    return (
                      <Pressable
                        key={cat.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => setSelectedCategory(cat.value)}
                        style={[
                          styles.topicChip,
                          active && styles.topicChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.topicText,
                            active && styles.topicTextActive,
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Input
                  label="Subject"
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Brief summary of your question or issue"
                  containerStyle={{ marginTop: Spacing.xs }}
                />

                <View style={styles.descContainer}>
                  <Text style={styles.inputLabel}>Message Details</Text>
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Provide any relevant details such as appointment date, doctor name, or specific question..."
                    placeholderTextColor={Palette.textMuted}
                    multiline
                    numberOfLines={4}
                    style={styles.descInput}
                  />
                </View>

                <Button
                  title="Submit Support Request"
                  onPress={handleSubmitTicket}
                  loading={submitting}
                  icon="paper-plane-outline"
                  style={styles.submitBtn}
                />
              </View>
            )}
          </Card>

          {/* Frequently Asked Questions */}
          <Card padded={false} style={styles.faqCard}>
            <View style={styles.faqHeader}>
              <View style={styles.faqTitleWrap}>
                <Ionicons
                  name="help-circle-outline"
                  size={20}
                  color={Palette.primary}
                />
                <Text style={styles.faqTitle}>Frequently Asked Questions</Text>
              </View>

              {/* Search FAQ */}
              <View style={styles.searchBar}>
                <Ionicons
                  name="search-outline"
                  size={16}
                  color={Palette.textMuted}
                />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search help topics..."
                  placeholderTextColor={Palette.textMuted}
                  style={styles.searchInput}
                />
                {searchQuery ? (
                  <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={Palette.textMuted}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {filteredFaqs.length === 0 ? (
              <View style={styles.emptyFaq}>
                <Text style={styles.emptyFaqText}>
                  No questions match "{searchQuery}".
                </Text>
              </View>
            ) : (
              filteredFaqs.map((faq, index) => {
                const expanded = openFaq === faq.question;
                return (
                  <View
                    key={faq.question}
                    style={[
                      index < filteredFaqs.length - 1 && styles.faqBorder,
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      onPress={() => toggleFaq(faq.question)}
                      style={({ pressed }) => [
                        styles.faqRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.faqQuestionWrap}>
                        <View style={styles.faqCategoryPill}>
                          <Text style={styles.faqCategoryText}>
                            {faq.category}
                          </Text>
                        </View>
                        <Text style={styles.faqQuestion}>{faq.question}</Text>
                      </View>
                      <Ionicons
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={Palette.primary}
                      />
                    </Pressable>
                    {expanded ? (
                      <Text
                        style={styles.faqAnswer}
                        accessibilityLiveRegion="polite"
                      >
                        {faq.answer}
                      </Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  tabBar: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: Palette.primary },
  tabLabel: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  tabLabelActive: { color: Palette.primary, fontWeight: "700" },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  // Emergency banner
  emergencyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: "#E11D48",
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.card,
  },
  emergencyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyTexts: { flex: 1, gap: 2 },
  emergencyTitle: {
    ...Typography.bodyMedium,
    fontWeight: "800",
    color: Palette.white,
  },
  emergencyBody: {
    ...Typography.caption,
    color: "rgba(255, 255, 255, 0.9)",
    lineHeight: 16,
    fontSize: 11,
  },
  // Channels
  channelList: { gap: Spacing.sm },
  channelCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.md,
    ...Shadows.card,
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  channelIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  channelTexts: { flex: 1, gap: 3 },
  channelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  channelLabel: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "700",
  },
  badgePill: {
    backgroundColor: "rgba(14, 159, 142, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgeText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontSize: 10,
    fontWeight: "700",
  },
  channelDetail: {
    ...Typography.caption,
    color: Palette.textMuted,
    lineHeight: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
  },
  actionButtonText: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  // Form
  formCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.25)",
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.card,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
    paddingBottom: Spacing.sm,
  },
  formHeaderTexts: { flex: 1, gap: 2 },
  formTitle: { ...Typography.h4, fontSize: 16, color: Palette.text },
  formSubtitle: { ...Typography.caption, color: Palette.textMuted },
  formFields: { gap: Spacing.sm },
  inputLabel: {
    ...Typography.label,
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  topicsRow: { gap: Spacing.xs, paddingVertical: 4 },
  topicChip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  topicChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  topicText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  topicTextActive: { color: Palette.white, fontWeight: "700" },
  descContainer: { gap: Spacing.xs, marginTop: Spacing.xs },
  descInput: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.md,
    minHeight: 88,
    textAlignVertical: "top",
    fontSize: 14,
    color: Palette.text,
  },
  submitBtn: { marginTop: Spacing.sm },
  ticketSuccessCard: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  ticketSuccessTexts: { alignItems: "center", gap: 4 },
  ticketSuccessTitle: {
    ...Typography.bodyMedium,
    fontWeight: "800",
    color: Palette.success,
  },
  ticketSuccessBody: { ...Typography.bodySmall, color: Palette.text },
  ticketBold: { fontWeight: "800", color: Palette.primaryDark },
  ticketSuccessSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 2,
  },
  successActions: { flexDirection: "row", gap: Spacing.sm },
  // FAQ
  faqCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.card,
  },
  faqHeader: {
    padding: Spacing.lg,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  faqTitleWrap: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  faqTitle: { ...Typography.h4, fontSize: 16, color: Palette.text },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.md,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Palette.text,
    paddingVertical: 0,
  },
  emptyFaq: { padding: Spacing.xl, alignItems: "center" },
  emptyFaqText: { ...Typography.caption, color: Palette.textMuted },
  faqRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  faqBorder: { borderBottomWidth: 1, borderBottomColor: Palette.divider },
  faqQuestionWrap: { flex: 1, gap: 4 },
  faqCategoryPill: {
    alignSelf: "flex-start",
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  faqCategoryText: {
    fontSize: 9,
    fontWeight: "700",
    color: Palette.primaryDark,
    textTransform: "uppercase",
  },
  faqQuestion: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "600",
  },
  faqAnswer: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 20,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  // My Tickets tab
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  errorText: { ...Typography.body, color: Palette.error, textAlign: "center" },
  emptyTitle: { ...Typography.h4, color: Palette.text, textAlign: "center" },
  emptySubtitle: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    textAlign: "center",
  },
  ticketList: {
    padding: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.xxxl,
  },
  ticketCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.md,
    gap: Spacing.xs,
    ...Shadows.card,
  },
  ticketCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ticketNum: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "700",
    fontSize: 11,
  },
  ticketSubject: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "600",
  },
  ticketMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ticketCategory: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  ticketDate: { ...Typography.caption, color: Palette.textMuted, fontSize: 11 },
  ticketLastMsg: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontStyle: "italic",
  },
  // Ticket detail modal
  modalContainer: { flex: 1, backgroundColor: Palette.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  modalTitle: { ...Typography.h4, color: Palette.text, flex: 1 },
  modalTicketNum: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "700",
  },
  messagesList: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 16 },
  msgBubble: { maxWidth: "80%", gap: 2 },
  msgBubbleRight: { alignSelf: "flex-end", alignItems: "flex-end" },
  msgBubbleLeft: { alignSelf: "flex-start", alignItems: "flex-start" },
  msgSenderName: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 10,
  },
  msgBody: {
    ...Typography.bodySmall,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    lineHeight: 18,
  },
  msgBodyRight: {
    backgroundColor: Palette.primary,
    color: Palette.white,
    borderBottomRightRadius: 2,
  },
  msgBodyLeft: {
    backgroundColor: Palette.surface,
    color: Palette.text,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  msgTime: { ...Typography.caption, color: Palette.textMuted, fontSize: 10 },
  noMessages: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: Spacing.xl,
  },
  replyBox: {
    padding: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  replyInput: {
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.md,
    minHeight: 70,
    textAlignVertical: "top",
    fontSize: 14,
    color: Palette.text,
  },
  resolvedNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  resolvedNoticeText: {
    ...Typography.caption,
    color: Palette.textMuted,
    flex: 1,
  },
  pressed: { opacity: 0.7 },
});
