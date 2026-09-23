/**
 * HealPoint - Super Admin · Subscription Management.
 *
 * Professional healthcare-SaaS control panel built ONLY from real backend
 * data (`/subscription/overview`, `/subscription`, `/subscription/plans`):
 *   - live overview stats (hospitals, active/trial/expired/cancelled,
 *     suspended/past-due, expiring soon)
 *   - revenue summary (total + paid, from stored records)
 *   - plan subscriber breakdown (real `subscriberCount` per plan, tappable to
 *     filter the list by that plan)
 *   - upcoming renewals from the backend's 60-day renewal window
 *   - backend search + status/plan/sort filters with pagination
 *
 * Performance: filter and search changes settle to a SINGLE request (search
 * keystrokes are debounced, filters read fresh refs - no stale rows sent).
 * Nothing is invented and no fake numbers are shown.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AdminModuleScreen } from "@/components/admin/AdminModuleScreen";
import { FilterChips } from "@/components/admin/FilterChips";
import { StatCard } from "@/components/admin/StatCard";
import { SubscriptionListSkeleton } from "@/components/admin/SubscriptionListSkeleton";
import { SubscriptionRow } from "@/components/admin/SubscriptionRow";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchBar } from "@/components/ui/SearchBar";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { formatINR, formatISODate } from "@/lib/format";
import { getPlanVideoLimit } from "@/lib/subscription-entitlement";
import { toErrorMessage } from "@/services/api";
import * as subscriptionService from "@/services/subscriptions";
import type {
  Subscription,
  SubscriptionListSort,
  SubscriptionOverview,
  SubscriptionPlan,
} from "@/types";

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Trial", value: "trial" },
  { label: "Past due", value: "past_due" },
  { label: "Expired", value: "expired" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Suspended", value: "suspended" },
];

const SORTS = [
  { label: "Renewal", value: "renewal" },
  { label: "Amount", value: "amount" },
  { label: "Hospital", value: "hospital" },
] as const;

export default function SuperAdminSubscriptionsScreen() {
  const router = useRouter();
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  const [items, setItems] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [sort, setSort] = useState<SubscriptionListSort>("renewal");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Always-fresh filter values so loadList never runs with a stale closure.
  const filtersRef = useRef({ query, status, plan, sort });
  filtersRef.current = { query, status, plan, sort };

  const loadOverview = useCallback(async () => {
    try {
      const [overviewRes, plansRes] = await Promise.all([
        subscriptionService.getSubscriptionOverview(),
        subscriptionService.getPlans(),
      ]);
      setOverview(overviewRes.overview);
      setPlans(plansRes.plans || []);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load subscription overview."));
    }
  }, []);

  const loadList = useCallback(async (nextPage = 1, append = false) => {
    const { query: q, status: s, plan: p, sort: o } = filtersRef.current;
    if (nextPage === 1) setLoading(true);
    else setLoadingMore(true);
    setError("");
    try {
      const res = await subscriptionService.getSubscriptions({
        search: q.trim() || undefined,
        status: s,
        plan: p,
        sort: o,
        page: nextPage,
        limit: 15,
      });
      setItems(
        append ? (prev) => [...prev, ...res.subscriptions] : res.subscriptions,
      );
      setTotal(res.totalCount);
      setPage(nextPage);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load subscriptions."));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // One fetch per filter/search change; search keystrokes are debounced.
  useEffect(() => {
    const timer = setTimeout(() => loadList(1), query.trim() ? 350 : 0);
    return () => clearTimeout(timer);
  }, [query, status, plan, sort, loadList]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadOverview(), loadList(1)]);
    } finally {
      setRefreshing(false);
    }
  }, [loadOverview, loadList]);

  const onEndReached = () => {
    if (!loading && !loadingMore && items.length < total)
      loadList(page + 1, true);
  };

  const planOptions = [
    { label: "All Plans", value: "all" },
    ...plans.map((item) => ({ label: item.name, value: item.key })),
  ];

  const maxSubscribers = Math.max(
    1,
    ...plans.map((item) => item.subscriberCount || 0),
  );
  const renewals = useMemo(
    () => (overview?.upcomingRenewals || []).slice(0, 5),
    [overview],
  );

  return (
    <AdminModuleScreen
      title="Subscription Management"
      subtitle={`${total} hospital subscription(s)`}
      loading={loading}
      error={error}
      onRetry={() => {
        loadOverview();
        loadList(1);
      }}
      loadingComponent={<SubscriptionListSkeleton />}
    >
      <View style={styles.pageWrap}>
        <FlatList
          data={items}
          keyExtractor={(item) => String(item._id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              colors={[Palette.primary]}
              tintColor={Palette.primary}
            />
          }
          ListHeaderComponent={
            <View style={styles.headerWrap}>
              <Card style={styles.heroCard}>
                <View style={styles.heroTexts}>
                  <Text style={styles.heroEyebrow}>Platform subscriptions</Text>
                  <Text style={styles.heroTitle}>
                    Subscription control panel
                  </Text>
                  <Text style={styles.heroSubtitle}>
                    {total} hospital subscription(s) ·{" "}
                    {overview?.activeSubscriptions ?? 0} active ·{" "}
                    {formatINR(overview?.revenue)} recorded revenue
                  </Text>
                </View>
                <View style={styles.heroIcon}>
                  <Ionicons
                    name="card-outline"
                    size={26}
                    color={Palette.primaryDark}
                  />
                </View>
              </Card>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.grid}>
                <StatCard
                  label="Hospitals"
                  value={overview?.totalHospitals ?? "—"}
                  icon="business-outline"
                  accent="#0E9F8E"
                />
                <StatCard
                  label="Active"
                  value={overview?.activeSubscriptions ?? "—"}
                  icon="checkmark-done-outline"
                  accent="#2E9E5B"
                />
                <StatCard
                  label="Trial"
                  value={overview?.trialCount ?? "—"}
                  icon="flask-outline"
                  accent="#2F80ED"
                />
                <StatCard
                  label="Expired"
                  value={overview?.expiredCount ?? "—"}
                  icon="time-outline"
                  accent="#D9435B"
                />
                <StatCard
                  label="Cancelled"
                  value={overview?.cancelledCount ?? "—"}
                  icon="close-circle-outline"
                  accent="#5F6F6C"
                />
                <StatCard
                  label="Suspended"
                  value={overview?.suspendedCount ?? "—"}
                  icon="pause-circle-outline"
                  accent="#7B61FF"
                />
                <StatCard
                  label="Past due"
                  value={overview?.pastDueCount ?? "—"}
                  icon="alert-circle-outline"
                  accent="#E89A3C"
                />
                <StatCard
                  label="Expiring ≤30d"
                  value={overview?.expiringCount ?? "—"}
                  icon="alarm-outline"
                  accent="#D9435B"
                />
              </View>
              <View style={styles.statsGrid}>
                <Card style={styles.revenueCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderTexts}>
                      <Text style={styles.sectionTitle}>Revenue</Text>
                      <Text style={styles.cardHeaderSub}>
                        Collected from stored subscription payments
                      </Text>
                    </View>
                    <View style={styles.cardHeaderIcon}>
                      <Ionicons
                        name="wallet-outline"
                        size={20}
                        color={Palette.success}
                      />
                    </View>
                  </View>
                  <View style={styles.revenueRow}>
                    <View style={styles.revenueItem}>
                      <Text style={styles.revenueLabel}>Total revenue</Text>
                      <Text style={styles.revenueValue}>
                        {formatINR(overview?.revenue)}
                      </Text>
                    </View>
                    <View style={styles.revenueItem}>
                      <Text style={styles.revenueLabel}>Paid</Text>
                      <Text style={styles.revenueValue}>
                        {formatINR(overview?.paidRevenue)}
                      </Text>
                    </View>
                    <View style={styles.revenueItem}>
                      <Text style={styles.revenueLabel}>
                        Active subscriptions
                      </Text>
                      <Text style={styles.revenueValue}>
                        {overview?.activeSubscriptions ?? "—"}
                      </Text>
                    </View>
                  </View>
                </Card>
                <Card style={styles.renewalCard}>
                  <Text style={styles.sectionTitle}>Plans & subscribers</Text>
                  {plans.length === 0 ? (
                    <Text style={styles.muted}>No plans configured yet.</Text>
                  ) : (
                    plans.map((planItem) => {
                      const count = planItem.subscriberCount || 0;
                      const widthPct = Math.min(
                        100,
                        Math.round((count / maxSubscribers) * 100),
                      );
                      const activeFilter = plan === planItem.key;
                      return (
                        <Pressable
                          key={planItem._id}
                          accessibilityRole="button"
                          accessibilityLabel={`Filter subscriptions by ${planItem.name}`}
                          onPress={() =>
                            setPlan(activeFilter ? "all" : planItem.key)
                          }
                          style={({ pressed }) => [
                            styles.planRow,
                            pressed && styles.planRowPressed,
                          ]}
                        >
                          <View style={styles.planTexts}>
                            <View style={styles.planNameRow}>
                              <Text style={styles.planName} numberOfLines={1}>
                                {planItem.name}
                              </Text>
                              <Badge
                                label={`${getPlanVideoLimit(planItem)} video calls/mo`}
                                variant="neutral"
                              />
                              <Badge
                                label={
                                  activeFilter
                                    ? "Filtering"
                                    : planItem.isActive
                                      ? "Active"
                                      : "Inactive"
                                }
                                variant={
                                  activeFilter
                                    ? "primary"
                                    : planItem.isActive
                                      ? "success"
                                      : "neutral"
                                }
                              />
                            </View>
                            <View style={styles.barTrack}>
                              <View
                                style={[
                                  styles.barFill,
                                  { width: `${widthPct}%` },
                                ]}
                              />
                            </View>
                          </View>
                          <View style={styles.planCount}>
                            <Text style={styles.planCountValue}>{count}</Text>
                            <Text style={styles.planCountLabel}>
                              hospital(s)
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                  <Button
                    title="Manage Plans"
                    variant="secondary"
                    fullWidth={false}
                    icon="pricetags-outline"
                    style={styles.plansButton}
                    onPress={() => router.push("/super-admin/plans")}
                  />
                </Card>
              </View>
              <Card style={styles.renewalCard}>
                <Text style={styles.sectionTitle}>Upcoming renewals</Text>
                {renewals.length === 0 ? (
                  <Text style={styles.muted}>
                    No upcoming renewals in the next 60 days.
                  </Text>
                ) : (
                  renewals.map((item) => (
                    <View
                      key={String(item.hospitalId)}
                      style={styles.renewalRow}
                    >
                      <View style={styles.renewalTexts}>
                        <Text style={styles.renewalName} numberOfLines={1}>
                          {item.hospitalName || "Hospital"}
                        </Text>
                        <Text style={styles.renewalPlan}>
                          {item.planName || item.planKey} ·{" "}
                          {formatINR(item.amount)}
                        </Text>
                      </View>
                      <Text style={styles.renewalDate}>
                        {formatISODate(item.expiryDate)}
                      </Text>
                    </View>
                  ))
                )}
              </Card>

              <View style={styles.searchWrap}>
                <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search hospital or plan..."
                />
              </View>
              <FilterChips
                options={STATUS_FILTERS}
                selected={status}
                onSelect={setStatus}
              />
              <FilterChips
                options={planOptions}
                selected={plan}
                onSelect={setPlan}
              />
              <FilterChips
                options={[...SORTS]}
                selected={sort}
                onSelect={(value) => setSort(value as SubscriptionListSort)}
              />
            </View>
          }
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                title="No subscriptions"
                message="Hospitals will appear here once the platform has subscriptions."
              />
            ) : null
          }
          renderItem={({ item }) => (
            <SubscriptionRow
              item={item}
              onPress={() =>
                router.push(`/super-admin/subscription/${item._id}` as never)
              }
            />
          )}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                color={Palette.primary}
                style={styles.footer}
              />
            ) : null
          }
        />
      </View>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  pageWrap: { flex: 1, width: "100%", maxWidth: 1200, alignSelf: "center" },
  listContent: { paddingBottom: Spacing.xxxl, gap: Spacing.md },
  headerWrap: { gap: Spacing.md, marginVertical: Spacing.xs },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
    padding: Spacing.xl,
  },
  heroTexts: { flex: 1, gap: Spacing.xs },
  heroEyebrow: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  heroTitle: { ...Typography.h3, color: Palette.text },
  heroSubtitle: { ...Typography.bodySmall, color: Palette.textMuted },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { ...Typography.label, color: Palette.text },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  revenueCard: { flex: 1, minWidth: "40%", gap: Spacing.md },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  cardHeaderTexts: { flex: 1, gap: 2 },
  cardHeaderSub: { ...Typography.caption, color: Palette.textMuted },
  cardHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  revenueRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  revenueItem: { flex: 1, minWidth: "40%", gap: 2 },
  revenueLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  revenueValue: { ...Typography.h4, color: Palette.primaryDark },
  renewalCard: { flex: 1, minWidth: "45%", gap: Spacing.sm },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  planRowPressed: { opacity: 0.7 },
  planTexts: { flex: 1, gap: Spacing.xs },
  planNameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  planName: { ...Typography.bodyMedium, color: Palette.text, flexShrink: 1 },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.background,
    overflow: "hidden",
  },
  barFill: { height: 6, borderRadius: 3, backgroundColor: Palette.primary },
  planCount: { alignItems: "flex-end", minWidth: 72 },
  planCountValue: { ...Typography.label, color: Palette.text },
  planCountLabel: { ...Typography.caption, color: Palette.textMuted },
  plansButton: { marginTop: Spacing.sm, alignSelf: "flex-start" },
  renewalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  renewalTexts: { flex: 1, gap: 2 },
  renewalName: { ...Typography.bodyMedium, color: Palette.text, flexShrink: 1 },
  renewalPlan: { ...Typography.caption, color: Palette.textMuted },
  renewalDate: { ...Typography.label, color: Palette.text },
  searchWrap: { paddingTop: Spacing.xs },
  muted: { ...Typography.bodySmall, color: Palette.textMuted },
  footer: { paddingVertical: Spacing.lg },
});
