import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import * as supportService from "@/services/support";
import type {
  AssignTicketPayload,
  EscalateTicketPayload,
  ResolveTicketPayload,
  ServiceDeskKpiSummary,
  SupportTicket,
  SupportTicketStatus,
  SupportTicketTeam,
} from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STATUS_TABS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "OPEN", label: "Open" },
  { id: "TRIAGED", label: "Triaged" },
  { id: "ASSIGNED", label: "Assigned" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "ESCALATED", label: "Escalated" },
  { id: "RESOLVED", label: "Resolved" },
  { id: "CLOSED", label: "Closed" },
];

const TEAMS: SupportTicketTeam[] = [
  "TIER_1_SUPPORT",
  "TIER_2_SUPPORT",
  "BILLING_TEAM",
  "CLINICAL_TEAM",
  "TECHNICAL_TEAM",
  "ESCALATIONS_TEAM",
  "MANAGEMENT",
];

function teamLabel(t: SupportTicketTeam): string {
  return t.replace(/_/g, " ");
}

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
    WAITING_FOR_PATIENT: "Awaiting Patient",
    WAITING_FOR_HOSPITAL: "Awaiting Hospital",
    ESCALATED: "Escalated",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
  };
  return map[s] ?? s;
}

// ---------------------------------------------------------------------------
// KPI Card Row
// ---------------------------------------------------------------------------
function KpiRow({ kpis }: { kpis: ServiceDeskKpiSummary }) {
  const cards = [
    {
      label: "Total Tickets",
      value: kpis.total,
      icon: "ticket-outline" as const,
      color: Palette.primary,
    },
    {
      label: "Active",
      value: kpis.activeCount,
      icon: "pulse-outline" as const,
      color: "#F59E0B",
    },
    {
      label: "Escalated",
      value: kpis.escalated,
      icon: "alert-circle-outline" as const,
      color: Palette.error,
    },
    {
      label: "Resolved",
      value: kpis.resolved,
      icon: "checkmark-done-outline" as const,
      color: Palette.success,
    },
    {
      label: "Resolution %",
      value: `${Math.round(kpis.resolutionRate)}%`,
      icon: "trending-up-outline" as const,
      color: Palette.success,
    },
    {
      label: "Avg Response",
      value: `${Math.round(kpis.avgFirstResponseMinutes)}m`,
      icon: "timer-outline" as const,
      color: Palette.primary,
    },
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.kpiRow}
    >
      {cards.map((c) => (
        <View key={c.label} style={styles.kpiCard}>
          <Ionicons name={c.icon} size={20} color={c.color} />
          <Text style={[styles.kpiValue, { color: c.color }]}>{c.value}</Text>
          <Text style={styles.kpiLabel}>{c.label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Ticket Action Modal
// ---------------------------------------------------------------------------
type ModalMode = "reply" | "assign" | "status" | "escalate" | "resolve" | null;

function TicketActionModal({
  ticket,
  mode,
  onClose,
  onSuccess,
}: {
  ticket: SupportTicket | null;
  mode: ModalMode;
  onClose: () => void;
  onSuccess: (updated: SupportTicket) => void;
}) {
  const [text, setText] = useState("");
  const [team, setTeam] = useState<SupportTicketTeam>("TIER_1_SUPPORT");
  const [newStatus, setNewStatus] = useState<SupportTicketStatus>("TRIAGED");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setText("");
    setError("");
  }, [mode, ticket]);

  if (!ticket || !mode) return null;

  const statusOptions: SupportTicketStatus[] = [
    "TRIAGED",
    "ASSIGNED",
    "IN_PROGRESS",
    "WAITING_FOR_PATIENT",
    "WAITING_FOR_HOSPITAL",
  ];

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      let res: { success: boolean; ticket: SupportTicket };
      if (mode === "reply") {
        if (!text.trim()) {
          setError("Reply cannot be empty.");
          return;
        }
        res = await supportService.postMessage(ticket._id, {
          body: text.trim(),
        });
      } else if (mode === "assign") {
        if (!text.trim()) {
          setError("Agent name/ID is required.");
          return;
        }
        const payload: AssignTicketPayload = {
          agentId: text.trim(),
          agentName: text.trim(),
          team,
        };
        res = await supportService.assignTicket(ticket._id, payload);
      } else if (mode === "status") {
        res = await supportService.updateStatus(ticket._id, {
          status: newStatus,
          note: text.trim() || undefined,
        });
      } else if (mode === "escalate") {
        if (!text.trim()) {
          setError("Escalation reason is required.");
          return;
        }
        const payload: EscalateTicketPayload = {
          reason: text.trim(),
          escalateTo: team,
          createCase: true,
        };
        res = await supportService.escalateTicket(ticket._id, payload);
      } else if (mode === "resolve") {
        if (!text.trim()) {
          setError("Resolution note is required.");
          return;
        }
        const payload: ResolveTicketPayload = { resolutionNote: text.trim() };
        res = await supportService.resolveTicket(ticket._id, payload);
      } else {
        return;
      }
      onSuccess(res.ticket);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ?? "Action failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    mode === "reply"
      ? "Reply to Ticket"
      : mode === "assign"
        ? "Assign Ticket"
        : mode === "status"
          ? "Update Status"
          : mode === "escalate"
            ? "Escalate Ticket"
            : "Resolve Ticket";

  return (
    <Modal
      visible={!!mode}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={Palette.text} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}
        >
          <Text style={styles.modalTicketRef}>
            {ticket.ticketNumber} — {ticket.subject}
          </Text>

          {error ? <FormMessage type="error" message={error} /> : null}

          {/* Team / status pickers */}
          {(mode === "assign" || mode === "escalate") && (
            <View style={{ gap: Spacing.xs }}>
              <Text style={styles.fieldLabel}>Team</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: Spacing.xs }}>
                  {TEAMS.map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setTeam(t)}
                      style={[
                        styles.chipOption,
                        team === t && styles.chipOptionActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipOptionText,
                          team === t && styles.chipOptionTextActive,
                        ]}
                      >
                        {teamLabel(t)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {mode === "status" && (
            <View style={{ gap: Spacing.xs }}>
              <Text style={styles.fieldLabel}>New Status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: Spacing.xs }}>
                  {statusOptions.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setNewStatus(s)}
                      style={[
                        styles.chipOption,
                        newStatus === s && styles.chipOptionActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipOptionText,
                          newStatus === s && styles.chipOptionTextActive,
                        ]}
                      >
                        {statusLabel(s)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          <Text style={styles.fieldLabel}>
            {mode === "reply"
              ? "Message"
              : mode === "assign"
                ? "Agent ID or Name"
                : mode === "status"
                  ? "Note (optional)"
                  : mode === "escalate"
                    ? "Escalation Reason"
                    : "Resolution Note"}
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={
              mode === "reply"
                ? "Write your reply to the patient…"
                : mode === "assign"
                  ? "Enter agent ID or name"
                  : mode === "status"
                    ? "Optional status note…"
                    : mode === "escalate"
                      ? "Describe why this is being escalated…"
                      : "Describe how this ticket was resolved…"
            }
            placeholderTextColor={Palette.textMuted}
            multiline={mode !== "assign"}
            numberOfLines={mode !== "assign" ? 4 : 1}
            style={styles.textArea}
          />

          <Button
            title={submitting ? "Processing…" : "Confirm"}
            onPress={handleSubmit}
            loading={submitting}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Ticket Card
// ---------------------------------------------------------------------------
function TicketCard({
  ticket,
  onAction,
}: {
  ticket: SupportTicket;
  onAction: (ticket: SupportTicket, mode: ModalMode) => void;
}) {
  const isActive = !["RESOLVED", "CLOSED"].includes(ticket.status);

  return (
    <Card style={styles.ticketCard}>
      {/* Header */}
      <View style={styles.ticketHeaderRow}>
        <Text style={styles.ticketNum}>{ticket.ticketNumber}</Text>
        <Badge
          label={statusLabel(ticket.status)}
          variant={statusVariant(ticket.status)}
        />
      </View>

      <Text style={styles.ticketSubject} numberOfLines={2}>
        {ticket.subject}
      </Text>

      {/* Meta row */}
      <View style={styles.ticketMeta}>
        <Text style={styles.ticketMetaText}>
          {ticket.category?.replace(/_/g, " ")}
        </Text>
        <Text style={styles.ticketMetaText}>
          {new Date(ticket.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          })}
        </Text>
        {ticket.patientName ? (
          <Text style={styles.ticketMetaText}>👤 {ticket.patientName}</Text>
        ) : null}
        {ticket.assignedTo?.name ? (
          <Text style={styles.ticketMetaText}>🔧 {ticket.assignedTo.name}</Text>
        ) : null}
      </View>

      {/* Action buttons */}
      {isActive && (
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => onAction(ticket, "reply")}
            style={styles.actionBtn}
          >
            <Ionicons
              name="chatbubble-outline"
              size={14}
              color={Palette.primary}
            />
            <Text style={styles.actionBtnText}>Reply</Text>
          </Pressable>
          <Pressable
            onPress={() => onAction(ticket, "assign")}
            style={styles.actionBtn}
          >
            <Ionicons
              name="person-add-outline"
              size={14}
              color={Palette.primary}
            />
            <Text style={styles.actionBtnText}>Assign</Text>
          </Pressable>
          <Pressable
            onPress={() => onAction(ticket, "status")}
            style={styles.actionBtn}
          >
            <Ionicons
              name="swap-horizontal-outline"
              size={14}
              color={Palette.primary}
            />
            <Text style={styles.actionBtnText}>Status</Text>
          </Pressable>
          <Pressable
            onPress={() => onAction(ticket, "escalate")}
            style={[styles.actionBtn, { borderColor: "#F59E0B" }]}
          >
            <Ionicons name="alert-circle-outline" size={14} color="#F59E0B" />
            <Text style={[styles.actionBtnText, { color: "#F59E0B" }]}>
              Escalate
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onAction(ticket, "resolve")}
            style={[styles.actionBtn, { borderColor: Palette.success }]}
          >
            <Ionicons
              name="checkmark-done-outline"
              size={14}
              color={Palette.success}
            />
            <Text style={[styles.actionBtnText, { color: Palette.success }]}>
              Resolve
            </Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------
export default function ServiceDeskAdminScreen() {
  const [kpis, setKpis] = useState<ServiceDeskKpiSummary | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [actionTicket, setActionTicket] = useState<SupportTicket | null>(null);
  const [actionMode, setActionMode] = useState<ModalMode>(null);

  const fetchAll = useCallback(async () => {
    try {
      setError("");
      const [kpiRes, ticketRes] = await Promise.all([
        supportService.getServiceDeskKpis(),
        supportService.getMyTickets({
          limit: 50,
          status: activeTab === "all" ? undefined : activeTab,
          search: search.trim() || undefined,
        }),
      ]);
      setKpis(kpiRes.kpis);
      setTickets(ticketRes.tickets ?? []);
    } catch {
      setError("Failed to load service desk data.");
    }
  }, [activeTab, search]);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const openAction = (ticket: SupportTicket, mode: ModalMode) => {
    setActionTicket(ticket);
    setActionMode(mode);
  };

  const handleActionSuccess = (updated: SupportTicket) => {
    setTickets((prev) =>
      prev.map((t) => (t._id === updated._id ? updated : t)),
    );
    setActionMode(null);
    setActionTicket(null);
    // Refresh KPIs
    supportService
      .getServiceDeskKpis()
      .then((r) => setKpis(r.kpis))
      .catch(() => {});
  };

  return (
    <View style={styles.safe}>
      <DrawerHeader
        title="Service Desk"
        subtitle="Customer support & ticket management"
      />

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={Palette.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by ticket #, subject, patient…"
            placeholderTextColor={Palette.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons
                name="close-circle"
                size={16}
                color={Palette.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* KPIs */}
      {kpis && !loading && (
        <View style={{ marginBottom: 4 }}>
          <KpiRow kpis={kpis} />
        </View>
      )}

      {/* Status Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
        style={styles.tabsScroll}
      >
        {STATUS_TABS.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={[
              styles.tabChip,
              activeTab === tab.id && styles.tabChipActive,
            ]}
          >
            <Text
              style={[
                styles.tabChipText,
                activeTab === tab.id && styles.tabChipTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Palette.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title="Retry"
            variant="outline"
            onPress={() => {
              setLoading(true);
              fetchAll().finally(() => setLoading(false));
            }}
            fullWidth={false}
          />
        </View>
      ) : tickets.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons
            name="headset-outline"
            size={40}
            color={Palette.textMuted}
          />
          <Text style={styles.emptyTitle}>No tickets</Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === "all"
              ? "No support tickets yet."
              : `No tickets with status "${activeTab}".`}
          </Text>
        </View>
      ) : (
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
            <TicketCard ticket={item} onAction={openAction} />
          )}
        />
      )}

      <TicketActionModal
        ticket={actionTicket}
        mode={actionMode}
        onClose={() => {
          setActionMode(null);
          setActionTicket(null);
        }}
        onSuccess={handleActionSuccess}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  searchWrap: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
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
  // KPI row
  kpiRow: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  kpiCard: {
    alignItems: "center",
    gap: 3,
    padding: Spacing.sm,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    minWidth: 90,
    ...Shadows.card,
  },
  kpiValue: { ...Typography.h3, fontWeight: "800" },
  kpiLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
    fontSize: 10,
  },
  // Tabs
  tabsScroll: { maxHeight: 48 },
  tabsRow: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    alignItems: "center",
    paddingVertical: 8,
  },
  tabChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  tabChipText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  tabChipTextActive: { color: Palette.white, fontWeight: "700" },
  // Ticket list
  ticketList: {
    padding: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.xxxl,
  },
  ticketCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.md,
    gap: Spacing.xs,
    backgroundColor: Palette.surface,
    ...Shadows.card,
  },
  ticketHeaderRow: {
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
  ticketMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  ticketMetaText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.primary,
  },
  actionBtnText: {
    ...Typography.caption,
    color: Palette.primary,
    fontSize: 11,
    fontWeight: "600",
  },
  // State
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
  // Modal
  modalContainer: { flex: 1, backgroundColor: Palette.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  modalTitle: { ...Typography.h4, color: Palette.text },
  modalTicketRef: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "700",
  },
  fieldLabel: { ...Typography.label, color: Palette.text },
  chipOption: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  chipOptionActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  chipOptionText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  chipOptionTextActive: { color: Palette.white, fontWeight: "700" },
  textArea: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.md,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 14,
    color: Palette.text,
  },
});
