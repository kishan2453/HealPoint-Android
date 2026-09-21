/**
 * HealPoint - Hospital Admin · Department Management.
 * Full production-grade department architecture:
 * - Scoped strictly to logged-in Hospital Admin's facility via /hospital-admin/departments
 * - Real-time statistics: Total Departments, Active, Inactive, Doctors Assigned
 * - Search by department name / description / head of department, status filters
 * - Department cards showing head of department, assigned doctors, appointment statistics
 * - Add Department modal & Edit Department modal with icon choices and status control
 * - Doctor-to-Department Mapping modal: multiselect assignment of hospital medical staff
 * - Status toggle (Active / Inactive) & safe deletion with confirmation
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AdminModuleScreen } from "@/components/admin/AdminModuleScreen";
import { StatCard } from "@/components/admin/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { SearchBar } from "@/components/ui/SearchBar";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { toErrorMessage } from "@/services/api";
import * as adminService from "@/services/admin";
import type {
  Doctor,
  HospitalDepartment,
  HospitalDepartmentStats,
} from "@/types";

type IconChoice =
  | "medkit"
  | "heart"
  | "fitness"
  | "eye"
  | "body"
  | "flask"
  | "bandage"
  | "business";

const AVAILABLE_ICONS: { name: IconChoice; label: string }[] = [
  { name: "medkit", label: "General" },
  { name: "heart", label: "Cardiology" },
  { name: "fitness", label: "Orthopedics" },
  { name: "eye", label: "Ophthalmology" },
  { name: "body", label: "Neurology" },
  { name: "flask", label: "Pathology" },
  { name: "bandage", label: "Surgery" },
  { name: "business", label: "Administration" },
];

export default function AdminDepartmentsScreen() {
  // Primary data state
  const [departments, setDepartments] = useState<HospitalDepartment[]>([]);
  const [departmentStats, setDepartmentStats] =
    useState<HospitalDepartmentStats | null>(null);
  const [hospitalDoctors, setHospitalDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successBanner, setSuccessBanner] = useState("");

  // Filtering state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<
    "all" | "active" | "inactive"
  >("all");

  // Add / Edit Modal state
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingDeptId, setEditingDeptId] = useState<string>("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formHOD, setFormHOD] = useState("");
  const [formIcon, setFormIcon] = useState<IconChoice>("medkit");
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Doctor Mapping Modal state
  const [mappingDept, setMappingDept] = useState<HospitalDepartment | null>(
    null,
  );
  const [selectedDoctorIds, setSelectedDoctorIds] = useState<string[]>([]);
  const [mappingSubmitting, setMappingSubmitting] = useState(false);
  const [mappingError, setMappingError] = useState("");

  // Safe Delete Dialog state
  const [deptToDelete, setDeptToDelete] = useState<HospitalDepartment | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  // Load departments, stats, and hospital doctors
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [deptRes, docRes] = await Promise.all([
        adminService.getHospitalDepartments({
          search: searchQuery.trim() || undefined,
          status: selectedStatus !== "all" ? selectedStatus : undefined,
        }),
        adminService.getHospitalDoctors(),
      ]);
      setDepartments(deptRes.departments || []);
      setDepartmentStats(deptRes.stats || null);
      setHospitalDoctors(docRes.data || docRes.doctors || []);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load departments."));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real statistics computation
  const stats = useMemo(() => {
    const total = departmentStats?.total ?? departments.length;
    const active =
      departmentStats?.active ??
      departments.filter((d) => d.isActive !== false).length;
    const inactive =
      departmentStats?.inactive ??
      departments.filter((d) => d.isActive === false).length;
    const totalDoctorsAssigned =
      departmentStats?.totalDoctors ??
      departments.reduce(
        (sum, d) => sum + (d.doctorCount ?? d.doctors?.length ?? 0),
        0,
      );

    return { total, active, inactive, totalDoctorsAssigned };
  }, [departments, departmentStats]);

  // Open Add Modal
  const openAddModal = () => {
    setModalMode("add");
    setEditingDeptId("");
    setFormName("");
    setFormDescription("");
    setFormHOD("");
    setFormIcon("medkit");
    setFormIsActive(true);
    setFormError("");
  };

  // Open Edit Modal
  const openEditModal = (dept: HospitalDepartment) => {
    setModalMode("edit");
    setEditingDeptId(dept._id);
    setFormName(dept.name || "");
    setFormDescription(dept.description || "");
    setFormHOD(dept.headOfDepartment || "");
    setFormIcon((dept.icon as IconChoice) || "medkit");
    setFormIsActive(dept.isActive !== false);
    setFormError("");
  };

  // Handle Add/Edit Submit
  const handleFormSubmit = async () => {
    setFormError("");
    if (!formName.trim()) {
      setFormError("Department name is required.");
      return;
    }

    setSubmitting(true);
    try {
      if (modalMode === "add") {
        await adminService.createHospitalDepartment({
          name: formName.trim(),
          description: formDescription.trim(),
          headOfDepartment: formHOD.trim(),
          icon: formIcon,
          isActive: formIsActive,
        });
        setSuccessBanner(
          `Department "${formName.trim()}" created successfully!`,
        );
      } else if (modalMode === "edit" && editingDeptId) {
        await adminService.updateHospitalDepartment(editingDeptId, {
          name: formName.trim(),
          description: formDescription.trim(),
          headOfDepartment: formHOD.trim(),
          icon: formIcon,
          isActive: formIsActive,
        });
        setSuccessBanner(
          `Department "${formName.trim()}" updated successfully!`,
        );
      }

      setModalMode(null);
      setTimeout(() => setSuccessBanner(""), 4000);
      void loadData();
    } catch (err) {
      setFormError(toErrorMessage(err, "Failed to save department."));
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Department Status (Active / Inactive)
  const handleToggleStatus = async (dept: HospitalDepartment) => {
    const nextIsActive = dept.isActive === false;
    try {
      await adminService.toggleHospitalDepartmentStatus(dept._id);
      setDepartments((prev) =>
        prev.map((d) =>
          d._id === dept._id ? { ...d, isActive: nextIsActive } : d,
        ),
      );
    } catch (err) {
      Alert.alert("Error", toErrorMessage(err, "Unable to change status."));
    }
  };

  // Safe Delete Department
  const handleDeleteDepartment = async () => {
    if (!deptToDelete) return;
    setDeleting(true);
    try {
      await adminService.deleteHospitalDepartment(deptToDelete._id);
      setDepartments((prev) => prev.filter((d) => d._id !== deptToDelete._id));
      setDeptToDelete(null);
      setSuccessBanner(`Department "${deptToDelete.name}" deleted.`);
      setTimeout(() => setSuccessBanner(""), 4000);
    } catch (err) {
      Alert.alert("Error", toErrorMessage(err, "Failed to delete department."));
    } finally {
      setDeleting(false);
    }
  };

  // Open Doctor Mapping Modal
  const openMappingModal = (dept: HospitalDepartment) => {
    setMappingDept(dept);
    const assignedIds: string[] = [];
    if (dept.doctors && Array.isArray(dept.doctors)) {
      dept.doctors.forEach((d) => {
        if (typeof d === "string") assignedIds.push(d);
        else if (d && d._id) assignedIds.push(d._id);
      });
    }
    hospitalDoctors.forEach((doc) => {
      if (
        (doc.department?.toLowerCase() === dept.name.toLowerCase() ||
          doc.speciality?.toLowerCase() === dept.name.toLowerCase()) &&
        !assignedIds.includes(doc._id)
      ) {
        assignedIds.push(doc._id);
      }
    });

    setSelectedDoctorIds(assignedIds);
    setMappingError("");
  };

  // Toggle doctor selection in mapping modal
  const toggleDoctorSelection = (docId: string) => {
    setSelectedDoctorIds((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId],
    );
  };

  // Save doctor mapping
  const handleSaveMapping = async () => {
    if (!mappingDept) return;
    setMappingSubmitting(true);
    setMappingError("");
    try {
      await adminService.mapHospitalDepartmentDoctors(
        mappingDept._id,
        selectedDoctorIds,
      );
      setSuccessBanner(
        `Assigned ${selectedDoctorIds.length} doctors to ${mappingDept.name}.`,
      );
      setTimeout(() => setSuccessBanner(""), 4000);
      setMappingDept(null);
      void loadData();
    } catch (err) {
      setMappingError(
        toErrorMessage(err, "Failed to update assigned doctors."),
      );
    } finally {
      setMappingSubmitting(false);
    }
  };

  return (
    <AdminModuleScreen
      title="Departments"
      subtitle="Hospital departments & doctor specialization"
      allowedRoles={["admin"]}
      loading={loading}
      error={error}
      onRetry={loadData}
    >
      {successBanner ? (
        <View style={styles.bannerWrap}>
          <FormMessage type="success" message={successBanner} />
        </View>
      ) : null}

      <View style={styles.actionHeader}>
        <View style={styles.actionHeaderInfo}>
          <Text style={styles.actionHeaderTitle}>Clinical Wings</Text>
          <Text style={styles.actionHeaderSub}>
            {departments.length} departments · {stats.totalDoctorsAssigned}{" "}
            doctors deployed
          </Text>
        </View>
        <Button
          title="Add Department"
          icon="add-circle"
          variant="primary"
          fullWidth={false}
          onPress={openAddModal}
        />
      </View>

      <View style={styles.statsScroll}>
        <StatCard
          label="Total Wings"
          value={stats.total}
          icon="business"
          accent={Palette.primary}
          hint="Registered departments"
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon="checkmark-circle"
          accent={Palette.success}
          hint="Open for appointments"
        />
        <StatCard
          label="Doctors Assigned"
          value={stats.totalDoctorsAssigned}
          icon="people"
          accent={Palette.info}
          hint="Staff across wings"
        />
        <StatCard
          label="Inactive"
          value={stats.inactive}
          icon="pause-circle"
          accent={Palette.warning}
          hint="Temporarily disabled"
        />
      </View>

      <View style={styles.searchWrap}>
        <SearchBar
          value={searchQuery}
          onChangeText={(text) => setSearchQuery(text)}
          placeholder="Search department name, HOD, description..."
        />
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>FILTER BY STATUS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {(["all", "active", "inactive"] as const).map((st) => (
            <Pressable
              key={st}
              onPress={() => setSelectedStatus(st)}
              style={[styles.chip, selectedStatus === st && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedStatus === st && styles.chipTextActive,
                ]}
              >
                {st === "all"
                  ? "All Departments"
                  : st === "active"
                    ? "Active"
                    : "Inactive"}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={departments}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            title="No departments found"
            message="Create clinical departments (e.g. Cardiology, Orthopedics) to organize your doctors."
          />
        }
        renderItem={({ item }) => {
          const isActive = item.isActive !== false;
          const iconKey =
            (item.icon as keyof typeof Ionicons.glyphMap) || "medkit";
          const assignedDoctorCount =
            item.doctorCount ?? item.doctors?.length ?? 0;
          const appointmentCount = item.appointmentCount ?? 0;

          return (
            <Card style={styles.deptCard}>
              <View style={styles.cardHeader}>
                <View style={styles.deptIconWrap}>
                  <Ionicons
                    name={iconKey}
                    size={24}
                    color={Palette.primaryDark}
                  />
                </View>
                <View style={styles.deptTitleWrap}>
                  <Text style={styles.deptName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.headOfDepartment ? (
                    <Text style={styles.deptHOD} numberOfLines={1}>
                      HOD: {item.headOfDepartment}
                    </Text>
                  ) : (
                    <Text style={styles.deptMuted}>
                      No Head of Dept designated
                    </Text>
                  )}
                </View>
                <Badge
                  label={isActive ? "Active" : "Inactive"}
                  variant={isActive ? "success" : "neutral"}
                />
              </View>

              {item.description ? (
                <Text style={styles.deptDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              <View style={styles.deptMetaRow}>
                <View style={styles.metaBadge}>
                  <Ionicons
                    name="people-outline"
                    size={14}
                    color={Palette.primary}
                  />
                  <Text style={styles.metaBadgeText}>
                    {assignedDoctorCount} Doctor(s)
                  </Text>
                </View>
                <View style={styles.metaBadge}>
                  <Ionicons
                    name="calendar-outline"
                    size={14}
                    color={Palette.info}
                  />
                  <Text style={styles.metaBadgeText}>
                    {appointmentCount} Booking(s)
                  </Text>
                </View>
              </View>

              <View style={styles.cardActionsRow}>
                <Button
                  title="Assign Doctors"
                  icon="person-add-outline"
                  variant="outline"
                  fullWidth={false}
                  onPress={() => openMappingModal(item)}
                />
                <Button
                  title="Edit"
                  icon="create-outline"
                  variant="outline"
                  fullWidth={false}
                  onPress={() => openEditModal(item)}
                />
                <Button
                  title={isActive ? "Disable" : "Enable"}
                  variant="ghost"
                  fullWidth={false}
                  onPress={() => handleToggleStatus(item)}
                />
                <Button
                  title="Delete"
                  icon="trash-outline"
                  variant="danger"
                  fullWidth={false}
                  onPress={() => setDeptToDelete(item)}
                />
              </View>
            </Card>
          );
        }}
      />

      {/* ADD / EDIT DEPARTMENT MODAL */}
      <Modal
        visible={modalMode !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalMode(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTop}>
              <View>
                <Text style={styles.modalTitle}>
                  {modalMode === "add"
                    ? "Create Department"
                    : "Edit Department"}
                </Text>
                <Text style={styles.modalSub}>
                  {modalMode === "add"
                    ? "Establish a new clinical specialty wing in your hospital"
                    : "Update specialty details and operational status"}
                </Text>
              </View>
              <Pressable
                onPress={() => setModalMode(null)}
                style={styles.modalCloseBtn}
                hitSlop={12}
              >
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.formScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {formError ? (
              <FormMessage type="error" message={formError} />
            ) : null}

            <Input
              label="Department Name *"
              placeholder="e.g. Cardiology, Dermatology, Pediatrics"
              value={formName}
              onChangeText={setFormName}
              leftIcon="business-outline"
            />

            <Input
              label="Head of Department"
              placeholder="e.g. Dr. A. K. Sharma"
              value={formHOD}
              onChangeText={setFormHOD}
              leftIcon="person-outline"
            />

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Department Icon</Text>
              <View style={styles.iconGrid}>
                {AVAILABLE_ICONS.map((ico) => (
                  <Pressable
                    key={ico.name}
                    onPress={() => setFormIcon(ico.name)}
                    style={[
                      styles.iconChoiceBtn,
                      formIcon === ico.name && styles.iconChoiceBtnActive,
                    ]}
                  >
                    <Ionicons
                      name={ico.name}
                      size={20}
                      color={
                        formIcon === ico.name
                          ? Palette.primaryDark
                          : Palette.textMuted
                      }
                    />
                    <Text
                      style={[
                        styles.iconChoiceLabel,
                        formIcon === ico.name && styles.iconChoiceLabelActive,
                      ]}
                    >
                      {ico.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Operational Status</Text>
              <View style={styles.statusRow}>
                {[
                  { active: true, label: "Active" },
                  { active: false, label: "Inactive" },
                ].map((st) => (
                  <Pressable
                    key={st.label}
                    onPress={() => setFormIsActive(st.active)}
                    style={[
                      styles.statusChoiceBtn,
                      formIsActive === st.active &&
                        styles.statusChoiceBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChoiceText,
                        formIsActive === st.active &&
                          styles.statusChoiceTextActive,
                      ]}
                    >
                      {st.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={styles.descInput}
                placeholder="Overview of treatments, technology, and clinical focus..."
                placeholderTextColor={Palette.textMuted}
                multiline
                numberOfLines={3}
                value={formDescription}
                onChangeText={setFormDescription}
              />
            </View>

            <View style={styles.formBtnRow}>
              <Button
                title="Cancel"
                variant="outline"
                fullWidth={false}
                onPress={() => setModalMode(null)}
                style={{ flex: 1 }}
              />
              <Button
                title={modalMode === "add" ? "Create Wing" : "Save Changes"}
                variant="primary"
                fullWidth={false}
                loading={submitting}
                onPress={handleFormSubmit}
                style={{ flex: 2 }}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* DOCTOR - DEPARTMENT MAPPING MODAL */}
      <Modal
        visible={Boolean(mappingDept)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMappingDept(null)}
      >
        {mappingDept ? (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTop}>
                <View>
                  <Text style={styles.modalTitle}>
                    Assign Doctors to {mappingDept.name}
                  </Text>
                  <Text style={styles.modalSub}>
                    Select doctors from your facility to associate with this
                    department
                  </Text>
                </View>
                <Pressable
                  onPress={() => setMappingDept(null)}
                  style={styles.modalCloseBtn}
                  hitSlop={12}
                >
                  <Ionicons name="close" size={24} color={Palette.text} />
                </Pressable>
              </View>
            </View>

            {mappingError ? (
              <View
                style={{
                  paddingHorizontal: Spacing.lg,
                  paddingTop: Spacing.sm,
                }}
              >
                <FormMessage type="error" message={mappingError} />
              </View>
            ) : null}

            <FlatList
              data={hospitalDoctors}
              keyExtractor={(item) => String(item._id)}
              contentContainerStyle={styles.mappingListContent}
              ListEmptyComponent={
                <EmptyState
                  title="No doctors in facility"
                  message="Enrol doctors first before assigning them to this department."
                />
              }
              renderItem={({ item }) => {
                const isChecked = selectedDoctorIds.includes(item._id);

                return (
                  <Pressable
                    onPress={() => toggleDoctorSelection(item._id)}
                    style={[
                      styles.doctorCheckRow,
                      isChecked && styles.doctorCheckRowActive,
                    ]}
                  >
                    <View style={styles.checkbox}>
                      {isChecked ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={Palette.primary}
                        />
                      ) : (
                        <Ionicons
                          name="ellipse-outline"
                          size={22}
                          color={Palette.textMuted}
                        />
                      )}
                    </View>
                    <View style={styles.doctorCheckInfo}>
                      <Text style={styles.doctorCheckName}>{item.name}</Text>
                      <Text style={styles.doctorCheckSub}>
                        {item.speciality || item.department || "General"} ·{" "}
                        {item.experience ?? 0} yrs exp
                      </Text>
                    </View>
                    {item.isActive === false ? (
                      <Badge label="Inactive" variant="neutral" />
                    ) : null}
                  </Pressable>
                );
              }}
            />

            <View style={styles.mappingFooter}>
              <Text style={styles.mappingFooterCount}>
                {selectedDoctorIds.length} doctor(s) assigned
              </Text>
              <Button
                title="Save Assignments"
                variant="primary"
                fullWidth={false}
                loading={mappingSubmitting}
                onPress={handleSaveMapping}
              />
            </View>
          </View>
        ) : null}
      </Modal>

      {/* Delete Department Confirmation Dialog */}
      <ConfirmDialog
        visible={Boolean(deptToDelete)}
        title="Delete Department?"
        message={`Are you sure you want to remove "${deptToDelete?.name || "this department"}"? Historical appointment data and doctors will be retained safely.`}
        confirmLabel="Delete Wing"
        cancelLabel="Keep"
        tone="danger"
        loading={deleting}
        onConfirm={handleDeleteDepartment}
        onCancel={() => setDeptToDelete(null)}
      />
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  bannerWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  actionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  actionHeaderInfo: { gap: 2 },
  actionHeaderTitle: { ...Typography.h3, color: Palette.text },
  actionHeaderSub: { ...Typography.caption, color: Palette.textMuted },
  statsScroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.md, flexDirection: "row", flexWrap: "wrap" },
  searchWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  filterSection: {
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  filterLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "700",
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.lg,
  },
  chipsScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  chipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  chipText: {
    ...Typography.caption,
    color: Palette.text,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#FFF",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  deptCard: {
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  deptIconWrap: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  deptTitleWrap: {
    flex: 1,
    gap: 2,
  },
  deptName: {
    ...Typography.h4,
    color: Palette.text,
  },
  deptHOD: {
    ...Typography.bodySmall,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  deptMuted: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  deptDesc: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  deptMetaRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  metaBadgeText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
  },
  cardActionsRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    flexWrap: "wrap",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  modalHeader: {
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    ...Shadows.card,
  },
  modalHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  modalSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    maxWidth: 280,
  },
  modalCloseBtn: {
    padding: Spacing.xs,
  },
  modalScroll: {
    flex: 1,
  },
  formScrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  fieldWrap: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    ...Typography.label,
    color: Palette.text,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  iconChoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  iconChoiceBtnActive: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
  iconChoiceLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  iconChoiceLabelActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  statusChoiceBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: "center",
  },
  statusChoiceBtnActive: {
    borderColor: Palette.primary,
    backgroundColor: Palette.primaryLight,
  },
  statusChoiceText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
  },
  statusChoiceTextActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  descInput: {
    minHeight: 80,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Typography.bodySmall,
    color: Palette.text,
    textAlignVertical: "top",
  },
  formBtnRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  mappingListContent: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: Spacing.xxxl,
  },
  doctorCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.md,
  },
  doctorCheckRowActive: {
    borderColor: Palette.primary,
    backgroundColor: Palette.primaryLight,
  },
  checkbox: {
    alignItems: "center",
    justifyContent: "center",
  },
  doctorCheckInfo: {
    flex: 1,
    gap: 2,
  },
  doctorCheckName: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  doctorCheckSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  mappingFooter: {
    padding: Spacing.lg,
    backgroundColor: Palette.surface,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...Shadows.card,
  },
  mappingFooterCount: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
});
