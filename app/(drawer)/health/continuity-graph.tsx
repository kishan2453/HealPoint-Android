/**
 * HealPoint — Smart Healthcare Continuity Graph Screen
 *
 * A production-grade server-driven relationship and view layer that dynamically
 * connects existing HealPoint healthcare records:
 *   Patient → Care Episode → Hospital → Department → Doctor → Appointment →
 *   Check-In → Consultation → Prescription → Lab Report → Follow-Up → Referral
 *
 * Features:
 *  - Dual visualization: Interactive Visual Nodal Graph & Episodic Continuity Tree
 *  - Real-time active care episode focus with intelligent next action routing
 *  - Timeframe filtering: ALL | CURRENT | RECENT | HISTORICAL | UPCOMING
 *  - Category filtering: All | Clinical | Network | Documents | Support
 *  - Server-enforced family member isolation with live context switching
 *  - Deep node inspection modal with direct navigation to existing record screens
 *  - AI Relationship Explanation powered by server-authorized relational facts
 *  - Comprehensive security audit logging
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { FamilyMemberFilterBar } from "@/components/FamilyMemberFilterBar";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import { toErrorMessage } from "@/services/api";
import * as continuityService from "@/services/continuityGraph";
import type {
  ContinuityCategory,
  ContinuityGraphData,
  ContinuityGraphEdge,
  ContinuityGraphNode,
  ContinuityNodeType,
  ContinuityTimeframe,
} from "@/types";

// ---------------------------------------------------------------------------
// Filter Options
// ---------------------------------------------------------------------------

const TIMEFRAME_TABS: { key: ContinuityTimeframe; label: string }[] = [
  { key: "ALL", label: "All Milestones" },
  { key: "CURRENT", label: "Current Focus" },
  { key: "RECENT", label: "Past 30 Days" },
  { key: "HISTORICAL", label: "Historical" },
  { key: "UPCOMING", label: "Upcoming" },
];

const CATEGORY_TABS: {
  key: ContinuityCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "all", label: "All Care", icon: "git-network-outline" },
  { key: "clinical", label: "Clinical", icon: "pulse-outline" },
  { key: "network", label: "Hospitals & Doctors", icon: "business-outline" },
  { key: "documents", label: "Documents", icon: "folder-outline" },
  { key: "support", label: "Support & Actions", icon: "shield-outline" },
];

// ---------------------------------------------------------------------------
// Node Type Visual Styling
// ---------------------------------------------------------------------------

interface NodeTypeConfig {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  badgeLabel: string;
}

const NODE_CONFIG: Record<ContinuityNodeType, NodeTypeConfig> = {
  patient: {
    icon: "person-outline",
    color: Palette.primary,
    bgColor: Palette.primaryLight,
    badgeLabel: "Patient",
  },
  family_member: {
    icon: "people-outline",
    color: "#6366F1",
    bgColor: "#EEF2FF",
    badgeLabel: "Family Member",
  },
  care_episode: {
    icon: "git-network-outline",
    color: "#0284C7",
    bgColor: "#E0F2FE",
    badgeLabel: "Care Episode",
  },
  hospital: {
    icon: "business-outline",
    color: "#059669",
    bgColor: "#ECFDF5",
    badgeLabel: "Hospital",
  },
  department: {
    icon: "medkit-outline",
    color: "#D97706",
    bgColor: "#FFFBEB",
    badgeLabel: "Department",
  },
  doctor: {
    icon: "fitness-outline",
    color: Palette.primary,
    bgColor: Palette.primaryLight,
    badgeLabel: "Doctor",
  },
  appointment: {
    icon: "calendar-outline",
    color: "#2563EB",
    bgColor: "#EFF6FF",
    badgeLabel: "Visit",
  },
  checkin: {
    icon: "qr-code-outline",
    color: "#10B981",
    bgColor: "#D1FAE5",
    badgeLabel: "Arrival",
  },
  consultation: {
    icon: "pulse-outline",
    color: "#7C3AED",
    bgColor: "#EDE9FE",
    badgeLabel: "Consultation",
  },
  prescription: {
    icon: "document-text-outline",
    color: "#059669",
    bgColor: "#ECFDF5",
    badgeLabel: "Prescription",
  },
  report: {
    icon: "bar-chart-outline",
    color: "#2563EB",
    bgColor: "#EFF6FF",
    badgeLabel: "Diagnostic",
  },
  followup: {
    icon: "refresh-outline",
    color: "#D97706",
    bgColor: "#FEF3C7",
    badgeLabel: "Follow-Up",
  },
  referral: {
    icon: "git-commit-outline",
    color: "#EA580C",
    bgColor: "#FFEDD5",
    badgeLabel: "Referral",
  },
  handover: {
    icon: "git-compare-outline",
    color: "#4F46E5",
    bgColor: "#EEF2FF",
    badgeLabel: "Handover",
  },
  medical_document: {
    icon: "folder-outline",
    color: "#4B5563",
    bgColor: "#F3F4F6",
    badgeLabel: "Document",
  },
  service_recovery: {
    icon: "shield-outline",
    color: "#DC2626",
    bgColor: "#FEE2E2",
    badgeLabel: "Service Action",
  },
};

export default function ContinuityGraphScreen() {
  const router = useRouter();
  const { appointmentId: paramApptId, familyMemberId: paramFmId } =
    useLocalSearchParams<{ appointmentId?: string; familyMemberId?: string }>();

  // State
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    paramFmId || "all",
  );
  const [timeframe, setTimeframe] = useState<ContinuityTimeframe>("ALL");
  const [category, setCategory] = useState<ContinuityCategory>("all");
  const [viewMode, setViewMode] = useState<"graph" | "tree">("graph");

  const [graphData, setGraphData] = useState<ContinuityGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected node inspection modal
  const [selectedNode, setSelectedNode] = useState<ContinuityGraphNode | null>(
    null,
  );

  // AI Summary modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiContext, setAiContext] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------
  const loadGraph = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setError(null);
      try {
        const res = await continuityService.getContinuityGraph({
          familyMemberId: selectedMemberId === "all" ? null : selectedMemberId,
          timeframe,
          category,
          appointmentId: paramApptId || null,
        });

        if (res?.success && res.graph) {
          setGraphData(res.graph);
        } else {
          throw new Error(res?.message || "Failed to load continuity graph");
        }
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedMemberId, timeframe, category, paramApptId],
  );

  useScreenFocus(loadGraph);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGraph(true);
  }, [loadGraph]);

  // Load AI Context
  const handleOpenAiSummary = async () => {
    setShowAiModal(true);
    setLoadingAi(true);
    try {
      const res = await continuityService.getContinuityAiContext();
      if (res?.success) {
        setAiContext(res.aiContext);
      } else {
        setAiContext("Unable to generate AI continuity analysis at this time.");
      }
    } catch {
      setAiContext("Unable to load AI continuity summary right now.");
    } finally {
      setLoadingAi(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Node Navigation Resolver
  // ---------------------------------------------------------------------------
  const handleNavigateNode = (node: ContinuityGraphNode) => {
    const meta = node.metadata || {};

    switch (node.type) {
      case "appointment":
      case "care_episode":
      case "checkin":
      case "consultation":
        if (meta.appointmentId) {
          router.push(`/appointment/${meta.appointmentId}` as never);
        }
        break;

      case "doctor":
        if (meta.doctorId) {
          router.push(`/booking/${meta.doctorId}` as never);
        } else {
          router.push("/doctors" as never);
        }
        break;

      case "hospital":
        if (meta.hospitalId) {
          router.push(`/hospital/${meta.hospitalId}` as never);
        } else {
          router.push("/hospitals" as never);
        }
        break;

      case "prescription":
        router.push("/health/prescriptions" as never);
        break;

      case "report":
        router.push("/health/reports" as never);
        break;

      case "referral":
        router.push("/health/referrals" as never);
        break;

      case "followup":
        router.push("/health/follow-ups" as never);
        break;

      case "medical_document":
        router.push("/health-wallet" as never);
        break;

      case "patient":
      case "family_member":
        router.push("/care-passport" as never);
        break;

      default:
        break;
    }

    setSelectedNode(null);
  };

  // ---------------------------------------------------------------------------
  // Relational Map computations
  // ---------------------------------------------------------------------------
  const { nodeMap, childrenMap, parentMap } = useMemo(() => {
    const nMap = new Map<string, ContinuityGraphNode>();
    const cMap = new Map<string, ContinuityGraphNode[]>();
    const pMap = new Map<string, ContinuityGraphNode[]>();

    if (!graphData)
      return { nodeMap: nMap, childrenMap: cMap, parentMap: pMap };

    graphData.nodes.forEach((n) => nMap.set(n.id, n));

    graphData.edges.forEach((edge) => {
      const srcNode = nMap.get(edge.source);
      const tgtNode = nMap.get(edge.target);

      if (srcNode && tgtNode) {
        // Children (outgoing)
        if (!cMap.has(edge.source)) cMap.set(edge.source, []);
        cMap.get(edge.source)!.push(tgtNode);

        // Parents (incoming)
        if (!pMap.has(edge.target)) pMap.set(edge.target, []);
        pMap.get(edge.target)!.push(srcNode);
      }
    });

    return { nodeMap: nMap, childrenMap: cMap, parentMap: pMap };
  }, [graphData]);

  // Group care episodes for tree view
  const episodes = useMemo(() => {
    if (!graphData) return [];
    return graphData.nodes.filter((n) => n.type === "care_episode");
  }, [graphData]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Top Navigation Header */}
      <View style={styles.header}>
        <DrawerToggleButton />
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Continuity Graph</Text>
          <Text style={styles.headerSubtitle}>
            Connected Care Network & Journey
          </Text>
        </View>

        <View style={styles.headerActions}>
          {/* AI Explainer Button */}
          <Pressable style={styles.iconBtn} onPress={handleOpenAiSummary}>
            <Ionicons name="sparkles" size={18} color="#0284C7" />
          </Pressable>

          {/* View Mode Toggle */}
          <Pressable
            style={[styles.iconBtn, styles.viewToggleBtn]}
            onPress={() => setViewMode(viewMode === "graph" ? "tree" : "graph")}
          >
            <Ionicons
              name={
                viewMode === "graph" ? "list-outline" : "git-network-outline"
              }
              size={18}
              color={Palette.primary}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Family Member Filter Bar */}
        <FamilyMemberFilterBar
          selectedMemberId={selectedMemberId}
          onSelectMember={(id: string) => setSelectedMemberId(id)}
        />

        {/* Timeframe Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsRow}
        >
          {TIMEFRAME_TABS.map((tab) => (
            <Pressable
              key={tab.key}
              style={[
                styles.timeframePill,
                timeframe === tab.key && styles.timeframePillActive,
              ]}
              onPress={() => setTimeframe(tab.key)}
            >
              <Text
                style={[
                  styles.timeframePillText,
                  timeframe === tab.key && styles.timeframePillTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Category Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {CATEGORY_TABS.map((cat) => (
            <Pressable
              key={cat.key}
              style={[
                styles.categoryChip,
                category === cat.key && styles.categoryChipActive,
              ]}
              onPress={() => setCategory(cat.key)}
            >
              <Ionicons
                name={cat.icon}
                size={14}
                color={category === cat.key ? Palette.white : Palette.textMuted}
              />
              <Text
                style={[
                  styles.categoryChipText,
                  category === cat.key && styles.categoryChipTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Main Content Area */}
        {loading && !refreshing ? (
          <Loading />
        ) : error ? (
          <ErrorState
            title="Failed to Load Continuity Graph"
            message={error}
            onRetry={() => loadGraph(true)}
          />
        ) : !graphData || graphData.nodes.length === 0 ? (
          <EmptyState
            title="No Connected Care Records"
            message="As you complete appointments, consult doctors, and receive prescriptions, your connected healthcare graph will automatically map relationships here."
          />
        ) : (
          <>
            {/* Active Care Episode & Recommended Next Action Banner */}
            {graphData.focus?.nextAction && (
              <Card style={styles.focusBanner}>
                <View style={styles.focusBannerHeader}>
                  <View style={styles.focusBadge}>
                    <Ionicons
                      name="sparkles"
                      size={12}
                      color={Palette.primary}
                    />
                    <Text style={styles.focusBadgeText}>
                      CURRENT CARE FOCUS
                    </Text>
                  </View>
                  <Text style={styles.focusBadgeSub}>Real-Time Action</Text>
                </View>

                <View style={styles.focusBody}>
                  <View style={styles.focusIconCircle}>
                    <Ionicons
                      name={
                        (graphData.focus.nextAction.icon +
                          "-outline") as keyof typeof Ionicons.glyphMap
                      }
                      size={20}
                      color={Palette.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.focusTitle}>
                      {graphData.focus.nextAction.label}
                    </Text>
                    <Text style={styles.focusDescription}>
                      Derived from your active clinical episode state
                    </Text>
                  </View>
                  <Button
                    title="Proceed"
                    onPress={() =>
                      router.push(graphData.focus.nextAction!.route as never)
                    }
                    fullWidth={false}
                    style={styles.focusActionBtn}
                  />
                </View>
              </Card>
            )}

            {/* Statistics Row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>
                  {graphData.stats.totalNodes}
                </Text>
                <Text style={styles.statLabel}>Connected Entities</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>
                  {graphData.stats.activeEpisodes}
                </Text>
                <Text style={styles.statLabel}>Active Episodes</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>
                  {graphData.stats.doctorsCount}
                </Text>
                <Text style={styles.statLabel}>Doctors</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>
                  {graphData.stats.hospitalsCount}
                </Text>
                <Text style={styles.statLabel}>Hospitals</Text>
              </View>
            </View>

            {/* View Mode: Interactive Visual Nodal Graph */}
            {viewMode === "graph" ? (
              <View style={styles.graphContainer}>
                <View style={styles.graphHeaderStrip}>
                  <Text style={styles.sectionHeaderTitle}>
                    Interactive Relationship Topology
                  </Text>
                  <Text style={styles.graphHint}>Tap any node to inspect</Text>
                </View>

                {/* Graph Canvas / Node Clusters */}
                <View style={styles.nodesCluster}>
                  {graphData.nodes.map((node) => {
                    const cfg =
                      NODE_CONFIG[node.type] || NODE_CONFIG.appointment;
                    const isFocus = node.id === graphData.focus?.focusNodeId;

                    return (
                      <Pressable
                        key={node.id}
                        style={[
                          styles.graphNodeCard,
                          isFocus && styles.graphNodeFocus,
                        ]}
                        onPress={() => setSelectedNode(node)}
                      >
                        <View style={styles.graphNodeTop}>
                          <View
                            style={[
                              styles.nodeIconCircle,
                              { backgroundColor: cfg.bgColor },
                            ]}
                          >
                            <Ionicons
                              name={cfg.icon}
                              size={16}
                              color={cfg.color}
                            />
                          </View>
                          <Badge
                            label={cfg.badgeLabel}
                            variant={
                              (node.statusVariant as BadgeVariant) || "neutral"
                            }
                          />
                        </View>

                        <Text style={styles.graphNodeLabel} numberOfLines={2}>
                          {node.label}
                        </Text>

                        {node.subLabel ? (
                          <Text style={styles.graphNodeSub} numberOfLines={1}>
                            {node.subLabel}
                          </Text>
                        ) : null}

                        {/* Connected Edge Count Pill */}
                        <View style={styles.nodeConnectionPill}>
                          <Ionicons
                            name="git-commit-outline"
                            size={11}
                            color={Palette.textMuted}
                          />
                          <Text style={styles.nodeConnectionText}>
                            {(childrenMap.get(node.id)?.length || 0) +
                              (parentMap.get(node.id)?.length || 0)}{" "}
                            links
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : (
              /* View Mode: Episodic Continuity Tree */
              <View style={styles.treeContainer}>
                <Text style={styles.sectionHeaderTitle}>
                  Episodic Continuity Journey
                </Text>

                {episodes.map((epNode, epIdx) => {
                  const connectedAppointments =
                    childrenMap
                      .get(epNode.id)
                      ?.filter((n) => n.type === "appointment") || [];

                  return (
                    <Card key={epNode.id} style={styles.episodeTreeCard}>
                      <View style={styles.episodeTreeHeader}>
                        <View style={styles.episodeHeaderLeft}>
                          <View style={styles.episodeNumberBadge}>
                            <Text style={styles.episodeNumberText}>
                              #{episodes.length - epIdx}
                            </Text>
                          </View>
                          <View>
                            <Text style={styles.episodeTreeTitle}>
                              {epNode.label}
                            </Text>
                            <Text style={styles.episodeTreeSub}>
                              {epNode.subLabel}
                            </Text>
                          </View>
                        </View>

                        <Badge
                          label={
                            epNode.status === "active" ? "Active" : "Completed"
                          }
                          variant={
                            epNode.status === "active" ? "primary" : "success"
                          }
                        />
                      </View>

                      {/* Chain of Care for this episode */}
                      {connectedAppointments.map((apptNode) => {
                        const apptChildren = childrenMap.get(apptNode.id) || [];
                        const consultNodes = apptChildren.filter(
                          (c) => c.type === "consultation",
                        );
                        const checkinNodes = apptChildren.filter(
                          (c) => c.type === "checkin",
                        );
                        const doctorNodes = apptChildren.filter(
                          (c) => c.type === "doctor",
                        );
                        const hospitalNodes = apptChildren.filter(
                          (c) => c.type === "hospital",
                        );

                        // Prescriptions & reports from consultation
                        const rxNodes = consultNodes.flatMap(
                          (c) =>
                            childrenMap
                              .get(c.id)
                              ?.filter((x) => x.type === "prescription") || [],
                        );
                        const reportNodes = consultNodes.flatMap(
                          (c) =>
                            childrenMap
                              .get(c.id)
                              ?.filter((x) => x.type === "report") || [],
                        );
                        const followupNodes = consultNodes.flatMap(
                          (c) =>
                            childrenMap
                              .get(c.id)
                              ?.filter((x) => x.type === "followup") || [],
                        );

                        return (
                          <View
                            key={apptNode.id}
                            style={styles.appointmentChainBlock}
                          >
                            {/* Step 1: Hospital & Attending Doctor */}
                            <View style={styles.chainStep}>
                              <View style={styles.chainIndicator}>
                                <View style={styles.chainDot} />
                                <View style={styles.chainLine} />
                              </View>
                              <View style={styles.chainContent}>
                                <Text style={styles.chainStepTitle}>
                                  Facility & Attending Physician
                                </Text>
                                <Text style={styles.chainStepDetail}>
                                  {hospitalNodes[0]?.label ||
                                    "HealPoint Hospital"}
                                  {" · "}
                                  {doctorNodes[0]?.label || "Attending Doctor"}
                                </Text>
                              </View>
                            </View>

                            {/* Step 2: Visit & Check-in */}
                            <View style={styles.chainStep}>
                              <View style={styles.chainIndicator}>
                                <View style={styles.chainDot} />
                                <View style={styles.chainLine} />
                              </View>
                              <View style={styles.chainContent}>
                                <Text style={styles.chainStepTitle}>
                                  Appointment Encounter
                                </Text>
                                <Text style={styles.chainStepDetail}>
                                  {apptNode.label} (
                                  {checkinNodes.length > 0
                                    ? checkinNodes[0].label
                                    : "Scheduled"}
                                  )
                                </Text>
                              </View>
                            </View>

                            {/* Step 3: Consultation & Prescriptions */}
                            <View style={styles.chainStep}>
                              <View style={styles.chainIndicator}>
                                <View style={styles.chainDot} />
                                <View style={styles.chainLine} />
                              </View>
                              <View style={styles.chainContent}>
                                <Text style={styles.chainStepTitle}>
                                  Clinical Outcome
                                </Text>
                                <Text style={styles.chainStepDetail}>
                                  {consultNodes.length > 0
                                    ? consultNodes[0].label
                                    : "Awaiting Consultation"}
                                </Text>
                                {rxNodes.length > 0 && (
                                  <Pressable
                                    onPress={() =>
                                      router.push("/health/prescriptions")
                                    }
                                  >
                                    <Text style={styles.chainLinkText}>
                                      • {rxNodes[0].label} (Tap to view)
                                    </Text>
                                  </Pressable>
                                )}
                                {reportNodes.length > 0 && (
                                  <Pressable
                                    onPress={() =>
                                      router.push("/health/reports")
                                    }
                                  >
                                    <Text style={styles.chainLinkText}>
                                      • {reportNodes[0].label} (Tap to view)
                                    </Text>
                                  </Pressable>
                                )}
                                {followupNodes.length > 0 && (
                                  <Text style={styles.chainFollowupNote}>
                                    Follow-up: {followupNodes[0].subLabel}
                                  </Text>
                                )}
                              </View>
                            </View>

                            {/* Open Encounter Button */}
                            <Button
                              title="Open Visit Details"
                              variant="outline"
                              onPress={() =>
                                router.push(
                                  `/appointment/${apptNode.metadata?.appointmentId}` as never,
                                )
                              }
                              style={{ marginTop: Spacing.sm }}
                            />
                          </View>
                        );
                      })}
                    </Card>
                  );
                })}
              </View>
            )}
          </>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* Node Detail Inspection Modal */}
      {selectedNode && (
        <Modal
          visible={Boolean(selectedNode)}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedNode(null)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setSelectedNode(null)}
          >
            <Pressable
              style={styles.modalSheet}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHandle} />

              <View style={styles.modalHeaderRow}>
                <View style={styles.modalIconWrap}>
                  <Ionicons
                    name={
                      NODE_CONFIG[selectedNode.type]?.icon ||
                      "information-circle-outline"
                    }
                    size={22}
                    color={
                      NODE_CONFIG[selectedNode.type]?.color || Palette.primary
                    }
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.modalNodeTitle} numberOfLines={1}>
                    {selectedNode.label}
                  </Text>
                  <Text style={styles.modalNodeSub}>
                    {selectedNode.subLabel ||
                      NODE_CONFIG[selectedNode.type]?.badgeLabel}
                  </Text>
                </View>

                <Pressable
                  onPress={() => setSelectedNode(null)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color={Palette.text} />
                </Pressable>
              </View>

              {/* Status and Timestamp */}
              <View style={styles.modalMetaRow}>
                <Badge
                  label={
                    selectedNode.status?.toUpperCase() ||
                    NODE_CONFIG[selectedNode.type]?.badgeLabel
                  }
                  variant={
                    (selectedNode.statusVariant as BadgeVariant) || "neutral"
                  }
                />
                {selectedNode.timestamp ? (
                  <Text style={styles.modalTimestamp}>
                    Date:{" "}
                    {new Date(selectedNode.timestamp).toLocaleDateString(
                      "en-IN",
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      },
                    )}
                  </Text>
                ) : null}
              </View>

              {/* Connected Relationships */}
              <View style={styles.modalRelationsSection}>
                <Text style={styles.modalRelationsHeader}>
                  Connected Relationships
                </Text>

                {/* Parents (Incoming) */}
                {(parentMap.get(selectedNode.id) || []).map((p) => (
                  <View key={p.id} style={styles.relationItem}>
                    <Ionicons
                      name="arrow-down-outline"
                      size={14}
                      color={Palette.primary}
                    />
                    <Text style={styles.relationText}>
                      Received from:{" "}
                      <Text style={{ fontWeight: "700" }}>{p.label}</Text>
                    </Text>
                  </View>
                ))}

                {/* Children (Outgoing) */}
                {(childrenMap.get(selectedNode.id) || []).map((c) => (
                  <View key={c.id} style={styles.relationItem}>
                    <Ionicons
                      name="arrow-forward-outline"
                      size={14}
                      color="#0284C7"
                    />
                    <Text style={styles.relationText}>
                      Generated:{" "}
                      <Text style={{ fontWeight: "700" }}>{c.label}</Text>
                    </Text>
                  </View>
                ))}

                {(parentMap.get(selectedNode.id) || []).length === 0 &&
                  (childrenMap.get(selectedNode.id) || []).length === 0 && (
                    <Text style={styles.noRelationsText}>
                      Direct encounter milestone within patient care network.
                    </Text>
                  )}
              </View>

              {/* Navigate Action Button */}
              <Button
                title="Open Related Record"
                onPress={() => handleNavigateNode(selectedNode)}
                style={{ marginTop: Spacing.md }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* AI Relational Context Modal */}
      <Modal
        visible={showAiModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAiModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowAiModal(false)}
        >
          <Pressable
            style={styles.modalSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRow}>
              <View
                style={[styles.modalIconWrap, { backgroundColor: "#E0F2FE" }]}
              >
                <Ionicons name="sparkles" size={22} color="#0284C7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalNodeTitle}>AI Care Relationship</Text>
                <Text style={styles.modalNodeSub}>
                  Server-Verified Factual Summary
                </Text>
              </View>
              <Pressable
                onPress={() => setShowAiModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={Palette.text} />
              </Pressable>
            </View>

            {loadingAi ? (
              <ActivityIndicator
                size="large"
                color={Palette.primary}
                style={{ marginVertical: Spacing.xl }}
              />
            ) : (
              <ScrollView
                style={{ maxHeight: 300, marginVertical: Spacing.md }}
              >
                <Text style={styles.aiContextText}>{aiContext}</Text>
              </ScrollView>
            )}

            <View style={styles.aiDisclaimerBox}>
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color={Palette.textMuted}
              />
              <Text style={styles.aiDisclaimerText}>
                Factual platform navigation and relational context only. Does
                not provide medical diagnosis or treatment.
              </Text>
            </View>

            <Button
              title="Close"
              variant="outline"
              onPress={() => setShowAiModal(false)}
              style={{ marginTop: Spacing.sm }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    gap: Spacing.sm,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  viewToggleBtn: {
    backgroundColor: Palette.primaryLight,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  // Filter Pills
  filterPillsRow: {
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  timeframePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  timeframePillActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  timeframePillText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  timeframePillTextActive: {
    color: Palette.white,
  },
  // Categories
  categoryRow: {
    gap: Spacing.xs,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  categoryChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  categoryChipText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  categoryChipTextActive: {
    color: Palette.white,
  },
  // Focus Banner
  focusBanner: {
    borderLeftWidth: 4,
    borderLeftColor: Palette.primary,
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
  },
  focusBannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  focusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  focusBadgeText: {
    ...Typography.caption,
    fontWeight: "800",
    color: Palette.primary,
    letterSpacing: 0.5,
    fontSize: 10,
  },
  focusBadgeSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  focusBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  focusIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  focusTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  focusDescription: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  focusActionBtn: {
    paddingHorizontal: Spacing.md,
  },
  // Stats
  statsRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  statBox: {
    flex: 1,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
  },
  statNumber: {
    ...Typography.h4,
    color: Palette.primary,
    fontWeight: "800",
  },
  statLabel: {
    ...Typography.caption,
    fontSize: 9,
    color: Palette.textMuted,
    textAlign: "center",
  },
  // Graph Mode
  graphContainer: {
    gap: Spacing.sm,
  },
  graphHeaderStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionHeaderTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  graphHint: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  nodesCluster: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  graphNodeCard: {
    width: "48%",
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
    gap: 4,
  },
  graphNodeFocus: {
    borderColor: Palette.primary,
    borderWidth: 2,
    backgroundColor: Palette.primaryLight + "15",
  },
  graphNodeTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  nodeIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  graphNodeLabel: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
    fontSize: 12,
  },
  graphNodeSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 10,
  },
  nodeConnectionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: Palette.surfaceAlt,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  nodeConnectionText: {
    ...Typography.caption,
    fontSize: 9,
    color: Palette.textMuted,
  },
  // Tree Mode
  treeContainer: {
    gap: Spacing.md,
  },
  episodeTreeCard: {
    gap: Spacing.md,
  },
  episodeTreeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  episodeHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  episodeNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  episodeNumberText: {
    ...Typography.caption,
    fontWeight: "800",
    color: Palette.primary,
  },
  episodeTreeTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  episodeTreeSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  appointmentChainBlock: {
    gap: Spacing.sm,
  },
  chainStep: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  chainIndicator: {
    alignItems: "center",
    width: 16,
  },
  chainDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Palette.primary,
    marginTop: 4,
  },
  chainLine: {
    width: 2,
    flex: 1,
    backgroundColor: Palette.border,
    marginVertical: 2,
  },
  chainContent: {
    flex: 1,
    paddingBottom: Spacing.xs,
  },
  chainStepTitle: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
  },
  chainStepDetail: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 1,
  },
  chainLinkText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "600",
    marginTop: 2,
  },
  chainFollowupNote: {
    ...Typography.caption,
    color: "#D97706",
    fontWeight: "600",
    marginTop: 2,
  },
  // Modal Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxHeight: "80%",
    gap: Spacing.sm,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.border,
    alignSelf: "center",
    marginBottom: Spacing.sm,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  modalNodeTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  modalNodeSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  modalCloseBtn: {
    padding: Spacing.xs,
  },
  modalMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: Spacing.xs,
  },
  modalTimestamp: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  modalRelationsSection: {
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  modalRelationsHeader: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
    marginBottom: 4,
  },
  relationItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  relationText: {
    ...Typography.caption,
    color: Palette.text,
    flex: 1,
  },
  noRelationsText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontStyle: "italic",
  },
  aiContextText: {
    ...Typography.bodySmall,
    color: Palette.text,
    lineHeight: 20,
  },
  aiDisclaimerBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  aiDisclaimerText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 10,
    flex: 1,
  },
});
