import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { DrawerHeader } from "@/components/drawer/DrawerHeader";
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

type Faq = {
  category: string;
  question: string;
  answer: string;
};

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

const TOPICS = [
  "Appointment & Scheduling",
  "Prescriptions & Reports",
  "Billing & Razorpay Payment",
  "Doctor Consultation Issue",
  "Account & Security",
];

export default function SupportScreen() {
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Support message state
  const [selectedTopic, setSelectedTopic] = useState(TOPICS[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState("");
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
      // Simulate real-time ticket creation with safe timing
      await new Promise((resolve) => setTimeout(resolve, 800));
      const ticketId = `HP-${Math.floor(100000 + Math.random() * 900000)}`;
      setTicketSuccess(ticketId);
      setSubject("");
      setMessage("");
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
                <Text style={styles.actionButtonText}>{option.actionText}</Text>
                <Ionicons
                  name="arrow-forward"
                  size={14}
                  color={Palette.primaryDark}
                />
              </Pressable>
            </Card>
          ))}
        </View>

        {/* Interactive Support Inquiry Form */}
        <Card style={styles.formCard}>
          <View style={styles.formHeader}>
            <Ionicons
              name="chatbubbles-outline"
              size={20}
              color={Palette.primary}
            />
            <View style={styles.formHeaderTexts}>
              <Text style={styles.formTitle}>Send a Support Message</Text>
              <Text style={styles.formSubtitle}>
                Our clinical coordination team will respond within 24 hours.
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
                  Inquiry Submitted Successfully
                </Text>
                <Text style={styles.ticketSuccessBody}>
                  Reference Ticket ID:{" "}
                  <Text style={styles.ticketBold}>{ticketSuccess}</Text>
                </Text>
                <Text style={styles.ticketSuccessSub}>
                  A confirmation has been recorded for{" "}
                  {user?.email || "your account"}. A care coordinator will
                  review your request shortly.
                </Text>
              </View>
              <Button
                title="Send Another Query"
                variant="outline"
                onPress={() => setTicketSuccess("")}
                style={styles.resetBtn}
              />
            </View>
          ) : (
            <View style={styles.formFields}>
              {formError ? (
                <FormMessage type="error" message={formError} />
              ) : null}

              {/* Topic Selector */}
              <Text style={styles.inputLabel}>Select Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.topicsRow}
              >
                {TOPICS.map((topic) => {
                  const active = selectedTopic === topic;
                  return (
                    <Pressable
                      key={topic}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setSelectedTopic(topic)}
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
                        {topic}
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
                  style={[index < filteredFaqs.length - 1 && styles.faqBorder]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
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
  emergencyTexts: {
    flex: 1,
    gap: 2,
  },
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
  channelList: {
    gap: Spacing.sm,
  },
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
  channelTexts: {
    flex: 1,
    gap: 3,
  },
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
  formHeaderTexts: {
    flex: 1,
    gap: 2,
  },
  formTitle: {
    ...Typography.h4,
    fontSize: 16,
    color: Palette.text,
  },
  formSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  formFields: {
    gap: Spacing.sm,
  },
  inputLabel: {
    ...Typography.label,
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  topicsRow: {
    gap: Spacing.xs,
    paddingVertical: 4,
  },
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
  topicTextActive: {
    color: Palette.white,
    fontWeight: "700",
  },
  descContainer: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
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
  submitBtn: {
    marginTop: Spacing.sm,
  },
  ticketSuccessCard: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  ticketSuccessTexts: {
    alignItems: "center",
    gap: 4,
  },
  ticketSuccessTitle: {
    ...Typography.bodyMedium,
    fontWeight: "800",
    color: Palette.success,
  },
  ticketSuccessBody: {
    ...Typography.bodySmall,
    color: Palette.text,
  },
  ticketBold: {
    fontWeight: "800",
    color: Palette.primaryDark,
  },
  ticketSuccessSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 2,
  },
  resetBtn: {
    marginTop: Spacing.sm,
  },
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
  faqTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  faqTitle: {
    ...Typography.h4,
    fontSize: 16,
    color: Palette.text,
  },
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
  emptyFaq: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  emptyFaqText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  faqRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  faqBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  faqQuestionWrap: {
    flex: 1,
    gap: 4,
  },
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
  pressed: {
    opacity: 0.7,
  },
});
