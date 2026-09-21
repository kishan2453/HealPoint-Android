/**
 * HealPoint - Admin · Support & Help.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Linking,
  Alert,
} from "react-native";

import { AdminModuleScreen } from "@/components/admin/AdminModuleScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { api, toErrorMessage } from "@/services/api";

const FAQS = [
  {
    q: "How do I add a new doctor?",
    a: "Navigate to Doctors -> click 'Add Doctor'. Ensure you fill out the specialty and department correctly.",
  },
  {
    q: "How do I approve a pending appointment?",
    a: "Go to Appointments, find the pending row, click on it to open details, and press Confirm.",
  },
  {
    q: "When will I get my payouts?",
    a: "Online payouts are settled to your linked Razorpay account on T+2 rolling days basis.",
  },
];

export default function AdminSupportScreen() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert("Validation Error", "Subject and Message are required.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/web/message", {
        name: "Hospital Admin",
        email: "admin@hospital",
        subject,
        message,
      });
      Alert.alert(
        "Message Sent",
        "Our support team will get back to you shortly.",
      );
      setSubject("");
      setMessage("");
    } catch (err) {
      Alert.alert("Error", toErrorMessage(err, "Failed to send message."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminModuleScreen
      title="Help & Support"
      subtitle="Get assistance for your hospital operations"
      allowedRoles={["admin", "super_admin"]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card padded style={styles.card}>
          <View style={styles.header}>
            <Ionicons name="headset" size={24} color={Palette.primary} />
            <Text style={styles.cardTitle}>Contact Platform Support</Text>
          </View>
          <Text style={styles.desc}>
            Need help configuring your hospital profile or managing slots? Send
            us a secure message.
          </Text>
          <Input
            placeholder="Subject"
            value={subject}
            onChangeText={setSubject}
          />
          <Input
            placeholder="Describe your issue in detail..."
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
          />
          <Button
            title="Submit Support Ticket"
            onPress={handleSubmit}
            loading={loading}
          />
        </Card>

        <Card padded style={styles.card}>
          <Text style={styles.cardTitle}>Frequently Asked Questions</Text>
          {FAQS.map((faq, i) => (
            <View key={i} style={styles.faqRow}>
              <Text style={styles.faqQ}>{faq.q}</Text>
              <Text style={styles.faqA}>{faq.a}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  card: { gap: Spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  cardTitle: { ...Typography.h4, color: Palette.text },
  desc: { ...Typography.body, color: Palette.textMuted },
  faqRow: { marginBottom: Spacing.md },
  faqQ: {
    ...Typography.body,
    fontWeight: "600",
    color: Palette.text,
    marginBottom: 4,
  },
  faqA: { ...Typography.bodySmall, color: Palette.textMuted, lineHeight: 20 },
});
