/**
 * HealPoint - Super Admin · Subscription Plans (picture-card catalog).
 *
 * Professional plan-management view that shows the REAL plan catalog stored
 * in the database. Every plan is rendered as a visual card:
 *
 *   PLAN IMAGE  →  PLAN NAME  →  PRICE  →  FEATURE CHECKLIST  →  STATUS  →  ACTIONS
 *
 * - plan artwork: the plan's own stored `imageUrl` when present, otherwise an
 *   original HealPoint healthcare-themed illustration matched to the plan key
 *   (no stock branding, no copied reference design)
 * - search + All/Active/Inactive filter computed over the REAL loaded plans
 *   (the plans API returns the full catalog; nothing is faked)
 * - details modal with large image, description, price, duration, features,
 *   status and created/updated dates
 * - create/edit form with image URL entry, library picker (base64 preview),
 *   replace, remove and upload-failure safety — the form never breaks if the
 *   image step fails
 * - activate/deactivate with a confirmation dialog, real backend toggle, then UI
 *   refresh (never a frontend-only fake status)
 *
 * Razorpay and the existing subscription purchase flow are untouched.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";

import { AdminModuleScreen } from "@/components/admin/AdminModuleScreen";
import { FilterChips } from "@/components/admin/FilterChips";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormMessage } from "@/components/ui/FormMessage";
import { SearchBar } from "@/components/ui/SearchBar";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { formatINR, formatISODate } from "@/lib/format";
import { getPlanImage } from "@/lib/image";
import { useResponsiveVariant } from "@/lib/responsive";
import { getPlanVideoLimit } from "@/lib/subscription-entitlement";
import { toErrorMessage } from "@/services/api";
import * as subscriptionService from "@/services/subscriptions";
import type { SubscriptionPlan } from "@/types";

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

const EMPTY_FORM = {
  key: "",
  name: "",
  monthlyPrice: "",
  yearlyPrice: "",
  videoConsultationsMonthly: "",
  features: "",
  trialDays: "",
  sortOrder: "",
  imageUrl: "",
  description: "",
};

function planKeyLabel(key?: string): string {
  const value = String(key || "").trim();
  if (!value) return "PLAN";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
export default function SuperAdminPlansScreen() {
  const variant = useResponsiveVariant();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<SubscriptionPlan | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [pendingStatus, setPendingStatus] = useState<SubscriptionPlan | null>(
    null,
  );
  const [statusLoading, setStatusLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await subscriptionService.getPlans();
      const sorted = [...(res.plans || [])].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
      );
      setPlans(sorted);
      setSelected((prev) =>
        prev ? (sorted.find((plan) => plan._id === prev._id) ?? null) : null,
      );
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load plans."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Search + status filter computed over the REAL loaded catalog. */
  const visiblePlans = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = plans;
    if (needle)
      list = list.filter(
        (plan) =>
          plan.name.toLowerCase().includes(needle) ||
          plan.key.toLowerCase().includes(needle),
      );
    if (status === "active") list = list.filter((plan) => plan.isActive);
    if (status === "inactive") list = list.filter((plan) => !plan.isActive);
    return list;
  }, [plans, query, status]);

  const openEditor = (plan: SubscriptionPlan | null) => {
    setEditing(plan);
    setError("");
    setActionError("");
    setNotice("");
    setForm(
      plan
        ? {
            key: plan.key,
            name: plan.name,
            monthlyPrice: String(plan.monthlyPrice ?? ""),
            yearlyPrice: String(plan.yearlyPrice ?? ""),
            videoConsultationsMonthly: String(
              typeof plan.videoConsultationsMonthly === "number"
                ? plan.videoConsultationsMonthly
                : getPlanVideoLimit(plan),
            ),
            features: (plan.features || []).join(", "),
            trialDays: String(plan.trialDays ?? ""),
            sortOrder: String(plan.sortOrder ?? ""),
            imageUrl: plan.imageUrl || "",
            description: plan.description || "",
          }
        : EMPTY_FORM,
    );
    setEditorOpen(true);
  };

  const savePlan = async () => {
    if (!form.name.trim()) {
      setActionError("Plan name is required.");
      return;
    }
    setSaving(true);
    setError("");
    setActionError("");
    try {
      const payload = {
        name: form.name.trim(),
        monthlyPrice: Number(form.monthlyPrice) || 0,
        yearlyPrice: Number(form.yearlyPrice) || 0,
        videoConsultationsMonthly: Math.max(
          0,
          Number(form.videoConsultationsMonthly) || 0,
        ),
        trialDays: Number(form.trialDays) || 0,
        sortOrder: Number(form.sortOrder) || 0,
        features: form.features
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        imageUrl: form.imageUrl.trim() || undefined,
        description: form.description.trim() || undefined,
      };
      if (editing) {
        await subscriptionService.updatePlan(editing._id, payload);
        setNotice(`${editing.name} was updated.`);
      } else {
        if (!form.key.trim()) {
          setActionError("Plan key is required for new plans.");
          setSaving(false);
          return;
        }
        await subscriptionService.createPlan({
          key: form.key.trim().toLowerCase(),
          ...payload,
          isActive: true,
        });
        setNotice("Plan created.");
      }
      setEditorOpen(false);
      load();
    } catch (err) {
      setActionError(toErrorMessage(err, "Unable to save plan."));
    } finally {
      setSaving(false);
    }
  };

  /** Real status toggle with confirmation → backend → refresh (never fake). */
  const runStatusToggle = async () => {
    if (!pendingStatus) return;
    setStatusLoading(true);
    setError("");
    setActionError("");
    try {
      const next = !pendingStatus.isActive;
      await subscriptionService.togglePlan(pendingStatus._id, next);
      setNotice(`${pendingStatus.name} ${next ? "activated" : "deactivated"}.`);
      setPendingStatus(null);
      load();
    } catch (err) {
      setActionError(toErrorMessage(err, "Unable to update plan status."));
      setPendingStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  const isDesktop = variant === "desktop";
  const isTablet = variant === "tablet";
  const columnWidth = isDesktop ? "30%" : isTablet ? "45%" : "100%";

  return (
    <AdminModuleScreen
      title="Subscription Plans"
      subtitle="Platform plan catalog stored in the database"
      loading={loading}
      error={error}
      onRetry={load}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create plan"
          onPress={() => openEditor(null)}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={24} color={Palette.white} />
        </Pressable>
      }
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrap}>
          <View style={styles.heroCard}>
            <View style={styles.heroTexts}>
              <Text style={styles.heroTitle}>Plan catalog</Text>
              <Text style={styles.heroSubtitle}>
                {plans.length} plan{plans.length === 1 ? "" : "s"} ·{" "}
                {plans.filter((plan) => plan.isActive).length} active ·{" "}
                {plans.filter((plan) => !plan.isActive).length} inactive
              </Text>
            </View>
            <View style={styles.heroIcon}>
              <Ionicons
                name="pricetags-outline"
                size={24}
                color={Palette.primaryDark}
              />
            </View>
          </View>

          {notice ? <FormMessage type="success" message={notice} /> : null}
          {actionError && !editorOpen ? (
            <FormMessage type="error" message={actionError} />
          ) : null}

          <View style={styles.searchWrap}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Search plan name..."
            />
          </View>
          <FilterChips
            options={STATUS_FILTERS}
            selected={status}
            onSelect={setStatus}
          />

          {visiblePlans.length === 0 ? (
            <EmptyState
              title="No plans found"
              message="Plans will appear here once they are added. Use + to create the first plan."
              action={
                <Button
                  title="Create plan"
                  variant="secondary"
                  icon="add-circle-outline"
                  onPress={() => openEditor(null)}
                />
              }
            />
          ) : (
            <View style={styles.grid}>
              {visiblePlans.map((plan, index) => (
                <PlanCard
                  key={plan._id}
                  plan={plan}
                  style={{ width: columnWidth }}
                  onOpen={() => setSelected(plan)}
                  onToggle={() => setPendingStatus(plan)}
                />
              ))}
            </View>
          )}

          {selected ? (
            <PlanDetailsModal
              plan={selected}
              onClose={() => setSelected(null)}
              onEdit={() => {
                setSelected(null);
                openEditor(selected);
              }}
            />
          ) : null}

          <PlanEditorModal
            visible={editorOpen}
            editing={editing}
            form={form}
            setForm={setForm}
            saving={saving}
            error={actionError}
            onSave={savePlan}
            onCancel={() => setEditorOpen(false)}
          />
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={Boolean(pendingStatus)}
        title={
          pendingStatus?.isActive
            ? `Deactivate ${pendingStatus?.name || "plan"}?`
            : `Activate ${pendingStatus?.name || "plan"}?`
        }
        message={
          pendingStatus?.isActive
            ? `${pendingStatus?.name || "This plan"} will stop being offered to new hospitals. Existing subscriptions are not affected.`
            : `${pendingStatus?.name || "This plan"} will become available for new hospital subscriptions.`
        }
        confirmLabel={pendingStatus?.isActive ? "Deactivate" : "Activate"}
        tone={pendingStatus?.isActive ? "danger" : "primary"}
        loading={statusLoading}
        onConfirm={runStatusToggle}
        onCancel={() => setPendingStatus(null)}
      />
    </AdminModuleScreen>
  );
}

interface PlanCardProps {
  plan: SubscriptionPlan;
  style?: StyleProp<ViewStyle>;
  onOpen: () => void;
  onToggle: () => void;
}

/** Visual subscription plan card: IMAGE → NAME → PRICE → FEATURES → STATUS → ACTIONS. */
function PlanCard({ plan, style, onOpen, onToggle }: PlanCardProps) {
  return (
    <Card style={[styles.planCard, style]}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open ${plan.name} details`}
      >
        <Image
          source={{ uri: getPlanImage(plan) }}
          style={styles.planImage}
          contentFit="cover"
          transition={250}
        />
        <View style={styles.planImageOverlay}>
          <Badge
            label={plan.isActive ? "ACTIVE" : "INACTIVE"}
            variant={plan.isActive ? "success" : "neutral"}
          />
        </View>
      </Pressable>

      <View style={styles.planBody}>
        <View style={styles.planTitleRow}>
          <View style={styles.planTitleWrap}>
            <Text style={styles.planName} numberOfLines={1}>
              {plan.name}
            </Text>
            <Text style={styles.planKey}>
              {planKeyLabel(plan.key)} · {plan.subscriberCount ?? 0} hospital(s)
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={Palette.textMuted}
          />
        </View>

        {plan.description ? (
          <Text style={styles.planDescription} numberOfLines={2}>
            {plan.description}
          </Text>
        ) : null}

        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {formatINR(plan.monthlyPrice)}
            <Text style={styles.pricePeriod}>/month</Text>
          </Text>
          <Text style={styles.priceDivider}>·</Text>
          <Text style={styles.price}>
            {formatINR(plan.yearlyPrice)}
            <Text style={styles.pricePeriod}>/year</Text>
          </Text>
        </View>

        <View style={styles.videoQuotaRow}>
          <Ionicons name="videocam" size={14} color={Palette.primary} />
          <Text style={styles.videoQuotaText}>
            {getPlanVideoLimit(plan)} Video Consultations / month
          </Text>
        </View>

        <View style={styles.featureList}>
          {(plan.features || []).map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={Palette.success}
              />
              <Text style={styles.featureText} numberOfLines={1}>
                {feature}
              </Text>
            </View>
          ))}
          {(plan.features || []).length === 0 ? (
            <Text style={styles.noFeatures}>No features listed yet.</Text>
          ) : null}
        </View>

        <View style={styles.planActions}>
          <Button
            title="View"
            variant="secondary"
            fullWidth={false}
            style={styles.planActionBtn}
            icon="eye-outline"
            onPress={onOpen}
          />
          <Button
            title={plan.isActive ? "Deactivate" : "Activate"}
            variant={plan.isActive ? "outline" : "primary"}
            fullWidth={false}
            style={styles.planActionBtn}
            icon={
              plan.isActive ? "pause-circle-outline" : "play-circle-outline"
            }
            onPress={onToggle}
          />
        </View>
      </View>
    </Card>
  );
}

interface PlanDetailsModalProps {
  plan: SubscriptionPlan;
  onClose: () => void;
  onEdit: () => void;
}

/** Professional subscription plan details — everything from the REAL database record. */
function PlanDetailsModal({ plan, onClose, onEdit }: PlanDetailsModalProps) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Dismiss"
        />
        <Card style={styles.detailsCard}>
          <Image
            source={{ uri: getPlanImage(plan) }}
            style={styles.detailsImage}
            contentFit="cover"
            transition={250}
          />
          <View style={styles.detailsBody}>
            <View style={styles.detailsHeader}>
              <View style={styles.detailsTexts}>
                <Text style={styles.detailsName}>{plan.name}</Text>
                <Text style={styles.detailsKey}>{planKeyLabel(plan.key)}</Text>
              </View>
              <Pressable
                onPress={onClose}
                style={styles.closeButton}
                accessibilityLabel="Close"
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={Palette.textMuted} />
              </Pressable>
            </View>

            <View style={styles.badgeRow}>
              <Badge
                label={plan.isActive ? "Active" : "Inactive"}
                variant={plan.isActive ? "success" : "neutral"}
              />
              <Badge
                label={`${plan.subscriberCount ?? 0} hospital(s)`}
                variant="primary"
              />
              {plan.trialDays ? (
                <Badge
                  label={`${plan.trialDays}-day trial`}
                  variant="warning"
                />
              ) : null}
            </View>

            {plan.description ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.sectionValue}>{plan.description}</Text>
              </View>
            ) : null}

            <View style={styles.detailGrid}>
              <View style={styles.detailCol}>
                <Text style={styles.detailLabel}>Monthly</Text>
                <Text style={styles.detailValue}>
                  {formatINR(plan.monthlyPrice)}
                </Text>
              </View>
              <View style={styles.detailCol}>
                <Text style={styles.detailLabel}>Yearly</Text>
                <Text style={styles.detailValue}>
                  {formatINR(plan.yearlyPrice)}
                </Text>
              </View>
              <View style={styles.detailCol}>
                <Text style={styles.detailLabel}>Video Quota</Text>
                <Text style={styles.detailValue}>
                  {getPlanVideoLimit(plan)} / month
                </Text>
              </View>
              <View style={styles.detailCol}>
                <Text style={styles.detailLabel}>Trial days</Text>
                <Text style={styles.detailValue}>{plan.trialDays ?? 0}</Text>
              </View>
              <View style={styles.detailCol}>
                <Text style={styles.detailLabel}>Sort order</Text>
                <Text style={styles.detailValue}>{plan.sortOrder ?? 0}</Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Features</Text>
              {(plan.features || []).map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={17}
                    color={Palette.success}
                  />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
              {(plan.features || []).length === 0 ? (
                <Text style={styles.noFeatures}>No features listed yet.</Text>
              ) : null}
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                Created {formatISODate(plan.createdAt)}
              </Text>
              <Text style={styles.metaText}>
                Updated {formatISODate(plan.updatedAt)}
              </Text>
            </View>

            <Button
              title="Edit plan"
              variant="secondary"
              icon="create-outline"
              onPress={onEdit}
            />
          </View>
        </Card>
      </View>
    </Modal>
  );
}
interface PlanEditorModalProps {
  visible: boolean;
  editing: SubscriptionPlan | null;
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  saving: boolean;
  error: string;
  onSave: () => void;
  onCancel: () => void;
}

/** Create/edit plan form with image URL entry + library picker + live preview. */
function PlanEditorModal({
  visible,
  editing,
  form,
  setForm,
  saving,
  error,
  onSave,
  onCancel,
}: PlanEditorModalProps) {
  const [imageError, setImageError] = useState("");
  const previewUri = getPlanImage({
    key: editing?.key,
    imageUrl: form.imageUrl || undefined,
  });

  const pickImage = async () => {
    setImageError("");
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setImageError(
          "Photo library permission is required to pick a plan image.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.6,
        base64: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0)
        return;
      const asset = result.assets[0];
      if (asset.base64) {
        const mime = asset.mimeType || "image/jpeg";
        setForm((prev) => ({
          ...prev,
          imageUrl: `data:${mime};base64,${asset.base64}`,
        }));
        setImageError("");
      } else {
        setImageError(
          "Could not read the selected image. Try again or paste an image URL instead.",
        );
      }
    } catch {
      setImageError(
        "Image picker is unavailable here. Paste an image URL instead.",
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {editing ? `Edit ${editing.name}` : "Create plan"}
          </Text>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            {/* Plan artwork */}
            <Text style={styles.label}>Plan image</Text>
            <Pressable
              onPress={pickImage}
              accessibilityRole="button"
              accessibilityLabel="Choose plan image"
            >
              <Image
                source={{ uri: previewUri }}
                style={styles.previewImage}
                contentFit="cover"
                transition={200}
              />
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={18} color={Palette.white} />
              </View>
            </Pressable>
            <Text style={styles.hint}>
              Tap the image to pick from your library, or paste a healthcare
              image URL below.
            </Text>
            {imageError ? (
              <FormMessage type="warning" message={imageError} />
            ) : null}
            <TextInput
              style={styles.input}
              value={form.imageUrl}
              onChangeText={(text) =>
                setForm((prev) => ({ ...prev, imageUrl: text }))
              }
              placeholder="https://... or data:image/... (optional)"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {form.imageUrl.trim() ? (
              <Pressable
                onPress={() => {
                  setForm((prev) => ({ ...prev, imageUrl: "" }));
                  setImageError("");
                }}
                style={({ pressed }) => [
                  styles.removeImage,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color={Palette.error}
                />
                <Text style={styles.removeImageText}>Remove image</Text>
              </Pressable>
            ) : null}
            <Text style={styles.label}>
              Plan key {editing ? `(${editing.key})` : ""} *
            </Text>
            <TextInput
              style={styles.input}
              value={form.key}
              onChangeText={(text) =>
                setForm((prev) => ({ ...prev, key: text }))
              }
              placeholder="e.g. premium"
              editable={!editing}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(text) =>
                setForm((prev) => ({ ...prev, name: text }))
              }
              placeholder="Premium"
            />

            <View style={styles.twoCol}>
              <View style={styles.twoColItem}>
                <Text style={styles.label}>Monthly price (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={form.monthlyPrice}
                  onChangeText={(text) =>
                    setForm((prev) => ({ ...prev, monthlyPrice: text }))
                  }
                  keyboardType="numeric"
                  placeholder="4999"
                />
              </View>
              <View style={styles.twoColItem}>
                <Text style={styles.label}>Yearly price (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={form.yearlyPrice}
                  onChangeText={(text) =>
                    setForm((prev) => ({ ...prev, yearlyPrice: text }))
                  }
                  keyboardType="numeric"
                  placeholder="49990"
                />
              </View>
            </View>
            <View style={styles.twoCol}>
              <View style={styles.twoColItem}>
                <Text style={styles.label}>Video consultations / mo *</Text>
                <TextInput
                  style={styles.input}
                  value={form.videoConsultationsMonthly}
                  onChangeText={(text) =>
                    setForm((prev) => ({
                      ...prev,
                      videoConsultationsMonthly: text,
                    }))
                  }
                  keyboardType="numeric"
                  placeholder="e.g. 4 for Gold, 7 Platinum, 10 Prime"
                />
              </View>
              <View style={styles.twoColItem}>
                <Text style={styles.label}>Sort order</Text>
                <TextInput
                  style={styles.input}
                  value={form.sortOrder}
                  onChangeText={(text) =>
                    setForm((prev) => ({ ...prev, sortOrder: text }))
                  }
                  keyboardType="numeric"
                  placeholder="1"
                />
              </View>
            </View>
            <View style={styles.twoCol}>
              <View style={styles.twoColItem}>
                <Text style={styles.label}>Trial days</Text>
                <TextInput
                  style={styles.input}
                  value={form.trialDays}
                  onChangeText={(text) =>
                    setForm((prev) => ({ ...prev, trialDays: text }))
                  }
                  keyboardType="numeric"
                  placeholder="14"
                />
              </View>
              <View style={styles.twoColItem} />
            </View>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textAreaSmall]}
              value={form.description}
              onChangeText={(text) =>
                setForm((prev) => ({ ...prev, description: text }))
              }
              placeholder="Short marketing description (optional)"
              multiline
            />
            <Text style={styles.label}>Features (comma-separated)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.features}
              onChangeText={(text) =>
                setForm((prev) => ({ ...prev, features: text }))
              }
              placeholder="Unlimited doctors, Priority support"
              multiline
            />
          </ScrollView>

          {error ? <FormMessage type="error" message={error} /> : null}

          <View style={styles.modalActions}>
            <Button
              title="Cancel"
              variant="outline"
              fullWidth={false}
              style={styles.modalActionBtn}
              onPress={onCancel}
              disabled={saving}
            />
            <Button
              title={editing ? "Save changes" : "Create plan"}
              fullWidth={false}
              style={styles.modalActionBtn}
              onPress={onSave}
              loading={saving}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  contentWrap: { width: "100%", maxWidth: 1200, alignSelf: "center" },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.7 },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  heroTexts: { flex: 1, gap: Spacing.xs },
  heroTitle: { ...Typography.h4, color: Palette.primaryDark },
  heroSubtitle: { ...Typography.bodySmall, color: Palette.textMuted },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: { paddingTop: Spacing.xs },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    justifyContent: "flex-start",
  },
  planCard: { gap: 0, overflow: "hidden" },
  planImage: {
    width: "100%",
    height: 150,
    backgroundColor: Palette.primaryLight,
  },
  planImageOverlay: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
  },
  planBody: { padding: Spacing.lg, gap: Spacing.sm },
  planTitleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  planTitleWrap: { flex: 1, gap: 2 },
  planName: { ...Typography.h4, color: Palette.text },
  planKey: { ...Typography.caption, color: Palette.textMuted },
  planDescription: { ...Typography.bodySmall, color: Palette.textMuted },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  price: { ...Typography.h4, color: Palette.text },
  pricePeriod: { ...Typography.caption, color: Palette.textMuted },
  priceDivider: { ...Typography.caption, color: Palette.border },
  featureList: { gap: Spacing.xs, marginTop: Spacing.xs },
  featureRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  featureText: { ...Typography.bodySmall, color: Palette.textMuted, flex: 1 },
  noFeatures: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontStyle: "italic",
  },
  planActions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  planActionBtn: { flex: 1, minHeight: 44 },
  backdrop: {
    flex: 1,
    backgroundColor: Palette.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  detailsCard: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "92%",
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    overflow: "hidden",
  },
  detailsImage: {
    width: "100%",
    height: 200,
    backgroundColor: Palette.primaryLight,
  },
  detailsBody: { padding: Spacing.xl, gap: Spacing.md },
  detailsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  detailsTexts: { flex: 1, gap: 2 },
  detailsName: { ...Typography.h4, color: Palette.text },
  detailsKey: { ...Typography.caption, color: Palette.textMuted },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.background,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  sectionCard: {
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: Palette.surface,
  },
  sectionTitle: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  sectionValue: { ...Typography.bodySmall, color: Palette.text },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  detailCol: { flex: 1, minWidth: "40%", gap: 2 },
  detailLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  detailValue: { ...Typography.bodySmall, color: Palette.text },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  metaText: { ...Typography.caption, color: Palette.textMuted },
  modalCard: {
    width: "100%",
    maxWidth: 540,
    maxHeight: "90%",
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  modalTitle: { ...Typography.h4, color: Palette.text },
  form: { maxHeight: 480, gap: Spacing.sm },
  label: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
    marginTop: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    color: Palette.text,
    backgroundColor: Palette.surface,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  textAreaSmall: { minHeight: 56, textAlignVertical: "top" },
  previewImage: {
    width: "100%",
    height: 140,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
  },
  cameraBadge: {
    position: "absolute",
    right: Spacing.sm,
    bottom: Spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(9, 20, 18, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { ...Typography.caption, color: Palette.textMuted },
  removeImage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    alignSelf: "flex-start",
    marginTop: Spacing.xs,
  },
  removeImageText: {
    ...Typography.bodySmall,
    color: Palette.error,
    fontWeight: "600",
  },
  twoCol: { flexDirection: "row", gap: Spacing.sm },
  twoColItem: { flex: 1 },
  modalActions: { flexDirection: "row", gap: Spacing.sm },
  modalActionBtn: { flex: 1 },
  videoQuotaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    alignSelf: "flex-start",
    marginTop: Spacing.xs,
  },
  videoQuotaText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
});
