/**
 * HealPoint - Hospital Admin · Doctor Management.
 * Full production-grade doctor management system:
 * - Scoped strictly to logged-in Hospital Admin's facility via /hospital-admin/doctors
 * - Real-time statistics: Total, Active, Inactive, Available
 * - Multi-criteria search, department filtering, status & availability filters, sorting
 * - Doctor Details Modal with 4 rich tabs: Profile, Scheduling, Appointments, Reviews
 * - Doctor active/inactive toggle, availability toggle, safe deletion
 * - Add Doctor modal with complete field validation (name, email, password, phone,
 *   qualifications, department, experience, fees, registration number, etc.)
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { DoctorListSkeleton } from "@/components/admin/DoctorListSkeleton";
import { DoctorRow } from "@/components/admin/DoctorRow";
import { StatCard } from "@/components/admin/StatCard";
import {
  StatusBadge,
  appointmentStatusBadge,
  verificationStatusBadge,
} from "@/components/admin/StatusBadge";
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
import { formatINR } from "@/lib/format";
import { getDoctorImage } from "@/lib/image";
import { toErrorMessage } from "@/services/api";
import * as adminService from "@/services/admin";
import type { Doctor, HospitalDepartment } from "@/types";

type SortOption = "name" | "experience" | "rating" | "fee";
type DetailTab = "profile" | "scheduling" | "appointments" | "reviews";

export default function AdminDoctorsScreen() {
  const router = useRouter();

  // Primary data state
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<HospitalDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Search & Filtering state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [selectedAvailability, setSelectedAvailability] = useState<
    "all" | "available" | "unavailable"
  >("all");
  const [sortBy, setSortBy] = useState<SortOption>("name");

  // Doctor Details Modal state
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [doctorDetailsLoading, setDoctorDetailsLoading] = useState(false);
  const [doctorDetailsData, setDoctorDetailsData] =
    useState<adminService.HospitalDoctorDetailResponse | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("profile");
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Add Doctor Modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formGender, setFormGender] = useState<"Male" | "Female" | "Other">(
    "Male",
  );
  const [formSpeciality, setFormSpeciality] = useState("");
  const [formDepartment, setFormDepartment] = useState("");
  const [formQualification, setFormQualification] = useState("");
  const [formExperience, setFormExperience] = useState("");
  const [formFees, setFormFees] = useState("");
  const [formRegNo, setFormRegNo] = useState("");
  const [formSlotDuration, setFormSlotDuration] = useState("30");
  const [formAbout, setFormAbout] = useState("");

  // Delete Confirmation state
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load doctors & departments
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [docRes, deptRes] = await Promise.all([
        adminService.getHospitalDoctors({
          search: searchQuery.trim() || undefined,
          status: selectedStatus !== "all" ? selectedStatus : undefined,
          availability:
            selectedAvailability !== "all" ? selectedAvailability : undefined,
        }),
        adminService.getHospitalDepartments(),
      ]);
      setDoctors(docRes.data || docRes.doctors || []);
      setDepartments(deptRes.departments || []);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load doctor data."));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedStatus, selectedAvailability]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load single doctor details when selected
  const openDoctorDetails = useCallback(async (doc: Doctor) => {
    setSelectedDoctor(doc);
    setActiveTab("profile");
    setDoctorDetailsData(null);
    setDoctorDetailsLoading(true);
    try {
      const details = await adminService.getHospitalDoctorDetails(doc._id);
      setDoctorDetailsData(details);
    } catch {
      setDoctorDetailsData({
        success: true,
        doctor: doc,
        stats: {
          appointmentCount: doc.appointmentCount ?? 0,
          rating: Number(doc.rating) || 0,
          reviewCount: doc.reviewCount ?? 0,
          slotCount: doc.timeSlots?.length ?? 0,
        },
      });
    } finally {
      setDoctorDetailsLoading(false);
    }
  }, []);

  // Filter & Sort doctors client-side for immediate responsive feel
  const filteredDoctors = useMemo(() => {
    let result = [...doctors];

    // Department filter
    if (selectedDepartment !== "all") {
      result = result.filter(
        (d) =>
          d.department?.toLowerCase() === selectedDepartment.toLowerCase() ||
          d.speciality?.toLowerCase() === selectedDepartment.toLowerCase() ||
          d.specialization?.toLowerCase() === selectedDepartment.toLowerCase(),
      );
    }

    // Status filter
    if (selectedStatus === "active") {
      result = result.filter((d) => d.isActive !== false);
    } else if (selectedStatus === "inactive") {
      result = result.filter((d) => d.isActive === false);
    }

    // Availability filter
    if (selectedAvailability === "available") {
      result = result.filter((d) => d.available !== false);
    } else if (selectedAvailability === "unavailable") {
      result = result.filter((d) => d.available === false);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "experience") {
        return (b.experience ?? 0) - (a.experience ?? 0);
      }
      if (sortBy === "rating") {
        return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      }
      if (sortBy === "fee") {
        return (a.fees ?? 0) - (b.fees ?? 0);
      }
      return (a.name || "").localeCompare(b.name || "");
    });

    return result;
  }, [
    doctors,
    selectedDepartment,
    selectedStatus,
    selectedAvailability,
    sortBy,
  ]);

  // Real stats calculation
  const stats = useMemo(() => {
    const total = doctors.length;
    const active = doctors.filter((d) => d.isActive !== false).length;
    const inactive = doctors.filter((d) => d.isActive === false).length;
    const available = doctors.filter(
      (d) => d.available !== false && d.isActive !== false,
    ).length;
    return { total, active, inactive, available };
  }, [doctors]);

  // Unique departments/specialties list for chips
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    departments.forEach((dept) => {
      if (dept.name) set.add(dept.name);
    });
    doctors.forEach((d) => {
      if (d.department) set.add(d.department);
      if (d.speciality) set.add(d.speciality);
    });
    return Array.from(set);
  }, [departments, doctors]);

  // Toggle Doctor Active Status
  const handleToggleActive = async () => {
    if (!selectedDoctor) return;
    const nextStatus = selectedDoctor.isActive === false;
    setStatusUpdating(true);
    try {
      await adminService.toggleHospitalDoctorActive(
        selectedDoctor._id,
        nextStatus,
      );
      setSelectedDoctor((prev) =>
        prev ? { ...prev, isActive: nextStatus } : null,
      );
      setDoctors((prev) =>
        prev.map((d) =>
          d._id === selectedDoctor._id ? { ...d, isActive: nextStatus } : d,
        ),
      );
    } catch (err) {
      Alert.alert(
        "Error",
        toErrorMessage(err, "Failed to update doctor status."),
      );
    } finally {
      setStatusUpdating(false);
    }
  };

  // Toggle Doctor Availability
  const handleToggleAvailability = async () => {
    if (!selectedDoctor) return;
    const nextAvail = selectedDoctor.available === false;
    setStatusUpdating(true);
    try {
      await adminService.updateHospitalDoctorAvailability(selectedDoctor._id, {
        available: nextAvail,
      });
      setSelectedDoctor((prev) =>
        prev ? { ...prev, available: nextAvail } : null,
      );
      setDoctors((prev) =>
        prev.map((d) =>
          d._id === selectedDoctor._id ? { ...d, available: nextAvail } : d,
        ),
      );
    } catch (err) {
      Alert.alert(
        "Error",
        toErrorMessage(err, "Failed to update doctor availability."),
      );
    } finally {
      setStatusUpdating(false);
    }
  };

  // Delete Doctor
  const handleDeleteDoctor = async () => {
    if (!selectedDoctor) return;
    setDeleting(true);
    try {
      await adminService.deleteHospitalDoctor(selectedDoctor._id);
      setDoctors((prev) => prev.filter((d) => d._id !== selectedDoctor._id));
      setDeleteConfirmVisible(false);
      setSelectedDoctor(null);
    } catch (err) {
      Alert.alert(
        "Error",
        toErrorMessage(err, "Failed to delete doctor record."),
      );
    } finally {
      setDeleting(false);
    }
  };

  // Add Doctor Form Submit
  const handleAddDoctorSubmit = async () => {
    setAddError("");

    if (!formName.trim()) {
      setAddError("Doctor name is required.");
      return;
    }
    if (!formEmail.trim() || !formEmail.includes("@")) {
      setAddError("Valid email address is required.");
      return;
    }
    if (!formPassword.trim() || formPassword.length < 6) {
      setAddError("Password must be at least 6 characters.");
      return;
    }
    if (!formPhone.trim()) {
      setAddError("Phone number is required.");
      return;
    }
    if (!formSpeciality.trim()) {
      setAddError("Speciality is required.");
      return;
    }
    if (!formQualification.trim()) {
      setAddError("Qualifications/degree is required (e.g. MBBS, MD).");
      return;
    }
    const expNum = parseInt(formExperience, 10);
    if (isNaN(expNum) || expNum < 1 || expNum > 60) {
      setAddError("Experience must be a number between 1 and 60 years.");
      return;
    }
    const feesNum = parseFloat(formFees);
    if (isNaN(feesNum) || feesNum < 100) {
      setAddError("Consultation fee must be at least ₹100.");
      return;
    }
    if (!formRegNo.trim()) {
      setAddError("Medical registration number is required.");
      return;
    }

    setAddSubmitting(true);
    try {
      const payload = {
        name: formName.trim(),
        email: formEmail.trim().toLowerCase(),
        password: formPassword.trim(),
        phone: formPhone.trim(),
        gender: formGender,
        speciality: formSpeciality.trim(),
        specialization: formSpeciality.trim(),
        department: formDepartment.trim() || formSpeciality.trim(),
        qualification: formQualification.trim(),
        degree: formQualification.trim(),
        experience: expNum,
        fees: feesNum,
        registrationNumber: formRegNo.trim(),
        slotDurationMinutes: parseInt(formSlotDuration, 10) || 30,
        about: formAbout.trim(),
      };

      await adminService.createHospitalDoctor(payload);

      setFormName("");
      setFormEmail("");
      setFormPassword("");
      setFormPhone("");
      setFormSpeciality("");
      setFormDepartment("");
      setFormQualification("");
      setFormExperience("");
      setFormFees("");
      setFormRegNo("");
      setFormAbout("");
      setAddModalVisible(false);
      setFormSuccess("Doctor added successfully!");
      setTimeout(() => setFormSuccess(""), 4000);

      void loadData();
    } catch (err) {
      setAddError(toErrorMessage(err, "Failed to add doctor."));
    } finally {
      setAddSubmitting(false);
    }
  };

  return (
    <AdminModuleScreen
      title="Doctor Management"
      subtitle="Hospital medical staff & scheduling"
      allowedRoles={["admin"]}
      loading={loading}
      error={error}
      onRetry={loadData}
    >
      {formSuccess ? (
        <View style={styles.bannerWrap}>
          <FormMessage type="success" message={formSuccess} />
        </View>
      ) : null}

      <View style={styles.actionHeader}>
        <View style={styles.actionHeaderInfo}>
          <Text style={styles.actionHeaderTitle}>Medical Faculty</Text>
          <Text style={styles.actionHeaderSub}>
            {filteredDoctors.length}{" "}
            {filteredDoctors.length === 1 ? "doctor" : "doctors"} enrolled
          </Text>
        </View>
        <Button
          title="Add Doctor"
          icon="add-circle"
          variant="primary"
          fullWidth={false}
          onPress={() => setAddModalVisible(true)}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statsScroll}
      >
        <StatCard
          label="Total Doctors"
          value={stats.total}
          icon="people"
          accent={Palette.primary}
          hint="Enrolled in facility"
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon="checkmark-circle"
          accent={Palette.success}
          hint="Eligible for booking"
        />
        <StatCard
          label="Available"
          value={stats.available}
          icon="pulse"
          accent={Palette.info}
          hint="Ready for slots"
        />
        <StatCard
          label="Inactive"
          value={stats.inactive}
          icon="pause-circle"
          accent={Palette.warning}
          hint="Suspended / Off-duty"
        />
      </ScrollView>

      <View style={styles.searchWrap}>
        <SearchBar
          value={searchQuery}
          onChangeText={(text) => setSearchQuery(text)}
          placeholder="Search by doctor name, email, specialty..."
        />
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>STATUS</Text>
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
                  ? "All Status"
                  : st === "active"
                    ? "Active"
                    : "Inactive"}
              </Text>
            </Pressable>
          ))}

          <View style={styles.chipDivider} />

          {(["all", "available", "unavailable"] as const).map((av) => (
            <Pressable
              key={av}
              onPress={() => setSelectedAvailability(av)}
              style={[
                styles.chip,
                selectedAvailability === av && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedAvailability === av && styles.chipTextActive,
                ]}
              >
                {av === "all"
                  ? "All Availability"
                  : av === "available"
                    ? "Available"
                    : "Unavailable"}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {departmentOptions.length > 0 ? (
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>DEPARTMENT</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            <Pressable
              onPress={() => setSelectedDepartment("all")}
              style={[
                styles.chip,
                selectedDepartment === "all" && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedDepartment === "all" && styles.chipTextActive,
                ]}
              >
                All Departments
              </Text>
            </Pressable>
            {departmentOptions.map((dept) => (
              <Pressable
                key={dept}
                onPress={() => setSelectedDepartment(dept)}
                style={[
                  styles.chip,
                  selectedDepartment === dept && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedDepartment === dept && styles.chipTextActive,
                  ]}
                >
                  {dept}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.sortSection}>
        <Text style={styles.sortLabel}>SORT BY:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortScroll}
        >
          {[
            { id: "name", label: "Name" },
            { id: "experience", label: "Experience" },
            { id: "rating", label: "Rating" },
            { id: "fee", label: "Consultation Fee" },
          ].map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setSortBy(item.id as SortOption)}
              style={[
                styles.sortChip,
                sortBy === item.id && styles.sortChipActive,
              ]}
            >
              <Text
                style={[
                  styles.sortChipText,
                  sortBy === item.id && styles.sortChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <DoctorListSkeleton />
      ) : (
        <FlatList
          data={filteredDoctors}
          keyExtractor={(item) => String(item._id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              title="No doctors match your criteria"
              message="Try adjusting search terms, department filters, or add a new doctor."
            />
          }
          renderItem={({ item, index }) => (
            <DoctorRow
              doctor={item}
              appointmentCount={item.appointmentCount}
              index={index}
              onPress={() => openDoctorDetails(item)}
            />
          )}
        />
      )}

      {/* DOCTOR DETAILS MODAL */}
      <Modal
        visible={Boolean(selectedDoctor)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedDoctor(null)}
      >
        {selectedDoctor ? (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTop}>
                <Image
                  source={{ uri: getDoctorImage(selectedDoctor) }}
                  style={styles.modalAvatar}
                  contentFit="cover"
                  transition={200}
                />
                <View style={styles.modalHeaderInfo}>
                  <Text style={styles.modalDoctorName} numberOfLines={1}>
                    {selectedDoctor.name || "Doctor"}
                  </Text>
                  <Text style={styles.modalDoctorSub} numberOfLines={1}>
                    {selectedDoctor.speciality ||
                      selectedDoctor.department ||
                      "Medical Staff"}
                  </Text>
                  <View style={styles.modalHeaderBadges}>
                    <Badge
                      label={
                        selectedDoctor.isActive !== false
                          ? "Active"
                          : "Inactive"
                      }
                      variant={
                        selectedDoctor.isActive !== false
                          ? "success"
                          : "neutral"
                      }
                    />
                    <Badge
                      label={
                        selectedDoctor.available !== false
                          ? "Available"
                          : "Unavailable"
                      }
                      variant={
                        selectedDoctor.available !== false
                          ? "primary"
                          : "warning"
                      }
                    />
                  </View>
                </View>
                <Pressable
                  onPress={() => setSelectedDoctor(null)}
                  style={styles.modalCloseBtn}
                  hitSlop={12}
                >
                  <Ionicons name="close" size={24} color={Palette.text} />
                </Pressable>
              </View>

              <View style={styles.modalActionsBar}>
                <Button
                  title={
                    selectedDoctor.isActive !== false
                      ? "Deactivate"
                      : "Activate"
                  }
                  variant={
                    selectedDoctor.isActive !== false ? "outline" : "primary"
                  }
                  fullWidth={false}
                  loading={statusUpdating}
                  onPress={handleToggleActive}
                />
                <Button
                  title={
                    selectedDoctor.available !== false
                      ? "Mark Away"
                      : "Mark Available"
                  }
                  variant="outline"
                  fullWidth={false}
                  loading={statusUpdating}
                  onPress={handleToggleAvailability}
                />
                <Button
                  title="Slots"
                  icon="calendar"
                  variant="outline"
                  fullWidth={false}
                  onPress={() => {
                    const docId = selectedDoctor._id;
                    setSelectedDoctor(null);
                    router.push({
                      pathname: "/admin/slots",
                      params: { doctorId: docId },
                    });
                  }}
                />
                <Button
                  title="Delete"
                  icon="trash"
                  variant="danger"
                  fullWidth={false}
                  onPress={() => setDeleteConfirmVisible(true)}
                />
              </View>

              <View style={styles.modalTabsBar}>
                {(
                  [
                    { id: "profile", label: "Profile" },
                    { id: "scheduling", label: "Scheduling" },
                    { id: "appointments", label: "Appointments" },
                    { id: "reviews", label: "Reviews" },
                  ] as const
                ).map((tab) => (
                  <Pressable
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    style={[
                      styles.modalTab,
                      activeTab === tab.id && styles.modalTabActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalTabText,
                        activeTab === tab.id && styles.modalTabTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {doctorDetailsLoading ? (
              <View style={styles.modalLoadingWrap}>
                <ActivityIndicator size="large" color={Palette.primary} />
                <Text style={styles.modalLoadingText}>
                  Loading doctor details & timetable...
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {activeTab === "profile" ? (
                  <View style={styles.tabSection}>
                    <Card style={styles.detailCard}>
                      <Text style={styles.sectionTitle}>
                        Professional Information
                      </Text>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>
                          Medical Registration No.
                        </Text>
                        <Text style={styles.infoValue}>
                          {selectedDoctor.registrationNumber || "Not provided"}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>
                          Degree / Qualification
                        </Text>
                        <Text style={styles.infoValue}>
                          {selectedDoctor.qualification ||
                            selectedDoctor.degree ||
                            "Not provided"}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>
                          Clinical Experience
                        </Text>
                        <Text style={styles.infoValue}>
                          {selectedDoctor.experience ?? 0} Years
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Consultation Fee</Text>
                        <Text
                          style={[
                            styles.infoValue,
                            { color: Palette.primaryDark, fontWeight: "700" },
                          ]}
                        >
                          {formatINR(selectedDoctor.fees)}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>
                          Assigned Department
                        </Text>
                        <Text style={styles.infoValue}>
                          {selectedDoctor.department || "General Practice"}
                        </Text>
                      </View>
                    </Card>

                    <Card style={styles.detailCard}>
                      <Text style={styles.sectionTitle}>Contact & Access</Text>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Email</Text>
                        <Text style={styles.infoValue}>
                          {selectedDoctor.email || "None"}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Phone</Text>
                        <Text style={styles.infoValue}>
                          {selectedDoctor.phone || "None"}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Gender</Text>
                        <Text style={styles.infoValue}>
                          {selectedDoctor.gender || "Not specified"}
                        </Text>
                      </View>
                    </Card>

                    {selectedDoctor.about ? (
                      <Card style={styles.detailCard}>
                        <Text style={styles.sectionTitle}>About Doctor</Text>
                        <Text style={styles.aboutText}>
                          {selectedDoctor.about}
                        </Text>
                      </Card>
                    ) : null}
                  </View>
                ) : null}

                {activeTab === "scheduling" ? (
                  <View style={styles.tabSection}>
                    <Card style={styles.detailCard}>
                      <Text style={styles.sectionTitle}>Slot Architecture</Text>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>
                          Default Slot Duration
                        </Text>
                        <Text style={styles.infoValue}>
                          {selectedDoctor.slotDurationMinutes || 30} Minutes
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>
                          Generated Slots in System
                        </Text>
                        <Text style={styles.infoValue}>
                          {doctorDetailsData?.stats?.slotCount ??
                            selectedDoctor.timeSlots?.length ??
                            0}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Available Slots</Text>
                        <Text
                          style={[
                            styles.infoValue,
                            { color: Palette.success, fontWeight: "700" },
                          ]}
                        >
                          {doctorDetailsData?.stats?.availableSlotsCount ??
                            (selectedDoctor.timeSlots || []).filter(
                              (s) => s.isAvailable !== false,
                            ).length}
                        </Text>
                      </View>
                    </Card>

                    <Card style={styles.detailCard}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Weekly Schedule</Text>
                        <Button
                          title="Open Schedule Studio"
                          icon="open-outline"
                          fullWidth={false}
                          variant="outline"
                          onPress={() => {
                            const docId = selectedDoctor._id;
                            setSelectedDoctor(null);
                            router.push({
                              pathname: "/admin/slots",
                              params: { doctorId: docId },
                            });
                          }}
                        />
                      </View>
                      {doctorDetailsData?.weeklySchedule &&
                      doctorDetailsData.weeklySchedule.length > 0 ? (
                        <View style={styles.scheduleList}>
                          {doctorDetailsData.weeklySchedule.map(
                            (sched, idx) => (
                              <View key={idx} style={styles.scheduleItem}>
                                <Text style={styles.scheduleDay}>
                                  {sched.day || `Day ${idx + 1}`}
                                </Text>
                                <Text style={styles.scheduleHours}>
                                  {sched.shifts
                                    ?.map((s: any) => `${s.start} - ${s.end}`)
                                    .join(", ") || "Off duty"}
                                </Text>
                              </View>
                            ),
                          )}
                        </View>
                      ) : (
                        <Text style={styles.mutedText}>
                          No regular weekly template configured. Click 'Open
                          Schedule Studio' to build timetable.
                        </Text>
                      )}
                    </Card>
                  </View>
                ) : null}

                {activeTab === "appointments" ? (
                  <View style={styles.tabSection}>
                    <View style={styles.statsGridRow}>
                      <Card style={styles.smallStatCard}>
                        <Text style={styles.smallStatVal}>
                          {doctorDetailsData?.stats?.totalAppointments ??
                            doctorDetailsData?.appointments?.length ??
                            selectedDoctor.appointmentCount ??
                            0}
                        </Text>
                        <Text style={styles.smallStatLabel}>TOTAL</Text>
                      </Card>
                      <Card style={styles.smallStatCard}>
                        <Text
                          style={[
                            styles.smallStatVal,
                            { color: Palette.success },
                          ]}
                        >
                          {doctorDetailsData?.stats?.completedAppointments ?? 0}
                        </Text>
                        <Text style={styles.smallStatLabel}>COMPLETED</Text>
                      </Card>
                      <Card style={styles.smallStatCard}>
                        <Text
                          style={[styles.smallStatVal, { color: Palette.info }]}
                        >
                          {doctorDetailsData?.stats?.upcomingAppointments ?? 0}
                        </Text>
                        <Text style={styles.smallStatLabel}>UPCOMING</Text>
                      </Card>
                    </View>

                    <Card style={styles.detailCard}>
                      <Text style={styles.sectionTitle}>Recent Bookings</Text>
                      {doctorDetailsData?.appointments &&
                      doctorDetailsData.appointments.length > 0 ? (
                        <View style={styles.appointmentsList}>
                          {doctorDetailsData.appointments.map((appt, idx) => (
                            <View
                              key={appt._id || idx}
                              style={styles.appointmentRow}
                            >
                              <View style={styles.appointmentMain}>
                                <Text style={styles.patientName}>
                                  {appt.patientName ||
                                    appt.patientId?.name ||
                                    "Patient"}
                                </Text>
                                <Text style={styles.apptTime}>
                                  {appt.date || appt.appointmentDate} ·{" "}
                                  {appt.time || appt.slotTime}
                                </Text>
                              </View>
                              <StatusBadge
                                value={appt.status}
                                variant={appointmentStatusBadge(appt.status)}
                              />
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.mutedText}>
                          No recent appointments recorded for this doctor.
                        </Text>
                      )}
                    </Card>
                  </View>
                ) : null}

                {activeTab === "reviews" ? (
                  <View style={styles.tabSection}>
                    <Card style={styles.ratingHeroCard}>
                      <Ionicons name="star" size={36} color={Palette.warning} />
                      <Text style={styles.ratingScore}>
                        {Number(
                          doctorDetailsData?.stats?.rating ||
                            selectedDoctor.rating ||
                            0,
                        ).toFixed(1)}
                      </Text>
                      <Text style={styles.ratingTotal}>
                        out of 5.0 ·{" "}
                        {doctorDetailsData?.stats?.reviewCount ??
                          selectedDoctor.reviewCount ??
                          0}{" "}
                        verified patient reviews
                      </Text>
                    </Card>

                    <Card style={styles.detailCard}>
                      <Text style={styles.sectionTitle}>Patient Feedback</Text>
                      {selectedDoctor.reviews &&
                      selectedDoctor.reviews.length > 0 ? (
                        <View style={styles.reviewsList}>
                          {selectedDoctor.reviews.map((rev, idx) => (
                            <View key={idx} style={styles.reviewItem}>
                              <View style={styles.reviewHeader}>
                                <Text style={styles.reviewAuthor}>
                                  {rev.patientName ||
                                    rev.name ||
                                    "Verified Patient"}
                                </Text>
                                <View style={styles.starsRow}>
                                  <Ionicons
                                    name="star"
                                    size={14}
                                    color={Palette.warning}
                                  />
                                  <Text style={styles.reviewRatingText}>
                                    {rev.rating ?? 5}
                                  </Text>
                                </View>
                              </View>
                              {rev.comment ? (
                                <Text style={styles.reviewComment}>
                                  {rev.comment}
                                </Text>
                              ) : null}
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.mutedText}>
                          No detailed written feedback submitted yet for this
                          medical officer.
                        </Text>
                      )}
                    </Card>
                  </View>
                ) : null}
              </ScrollView>
            )}
          </View>
        ) : null}
      </Modal>

      {/* ADD DOCTOR MODAL */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTop}>
              <View>
                <Text style={styles.modalDoctorName}>Enrol New Doctor</Text>
                <Text style={styles.modalDoctorSub}>
                  Add a verified medical officer to your hospital
                </Text>
              </View>
              <Pressable
                onPress={() => setAddModalVisible(false)}
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
            {addError ? <FormMessage type="error" message={addError} /> : null}

            <Text style={styles.formSectionHeader}>PERSONAL & CREDENTIALS</Text>
            <Input
              label="Full Name *"
              placeholder="e.g. Dr. Rajesh Sharma"
              value={formName}
              onChangeText={setFormName}
              leftIcon="person-outline"
            />
            <Input
              label="Official Email *"
              placeholder="doctor@hospital.org"
              keyboardType="email-address"
              autoCapitalize="none"
              value={formEmail}
              onChangeText={setFormEmail}
              leftIcon="mail-outline"
            />
            <Input
              label="Password *"
              placeholder="Min 6 characters"
              secureTextEntry={!showPassword}
              value={formPassword}
              onChangeText={setFormPassword}
              leftIcon="lock-closed-outline"
              rightSlot={
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={Palette.textMuted}
                  />
                </Pressable>
              }
            />
            <Input
              label="Phone Number *"
              placeholder="e.g. 9876543210"
              keyboardType="phone-pad"
              value={formPhone}
              onChangeText={setFormPhone}
              leftIcon="call-outline"
            />

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Gender</Text>
              <View style={styles.genderRow}>
                {(["Male", "Female", "Other"] as const).map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => setFormGender(g)}
                    style={[
                      styles.genderBtn,
                      formGender === g && styles.genderBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.genderText,
                        formGender === g && styles.genderTextActive,
                      ]}
                    >
                      {g}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Text style={[styles.formSectionHeader, { marginTop: Spacing.md }]}>
              CLINICAL SPECIALIZATION
            </Text>
            <Input
              label="Speciality *"
              placeholder="e.g. Cardiology, Orthopedics, Pediatrics"
              value={formSpeciality}
              onChangeText={setFormSpeciality}
              leftIcon="medkit-outline"
            />

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Department</Text>
              {departments.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.deptPickerScroll}
                >
                  {departments.map((dept) => (
                    <Pressable
                      key={dept._id}
                      onPress={() => setFormDepartment(dept.name)}
                      style={[
                        styles.deptPickerChip,
                        formDepartment === dept.name &&
                          styles.deptPickerChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.deptPickerText,
                          formDepartment === dept.name &&
                            styles.deptPickerTextActive,
                        ]}
                      >
                        {dept.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              <Input
                placeholder="Or type custom department name..."
                value={formDepartment}
                onChangeText={setFormDepartment}
                containerStyle={{ marginTop: Spacing.xs }}
              />
            </View>

            <Input
              label="Degree / Qualifications *"
              placeholder="e.g. MBBS, MD, DM (Cardiology)"
              value={formQualification}
              onChangeText={setFormQualification}
              leftIcon="school-outline"
            />
            <Input
              label="Experience (Years) *"
              placeholder="e.g. 8"
              keyboardType="number-pad"
              value={formExperience}
              onChangeText={setFormExperience}
              leftIcon="time-outline"
            />
            <Input
              label="Consultation Fee (₹) *"
              placeholder="Min 100 (e.g. 500)"
              keyboardType="number-pad"
              value={formFees}
              onChangeText={setFormFees}
              leftIcon="cash-outline"
            />
            <Input
              label="Medical Registration Number *"
              placeholder="e.g. MCI-2021-98765"
              value={formRegNo}
              onChangeText={setFormRegNo}
              leftIcon="document-text-outline"
            />

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Consultation Slot Duration</Text>
              <View style={styles.durationRow}>
                {["15", "20", "30", "45", "60"].map((mins) => (
                  <Pressable
                    key={mins}
                    onPress={() => setFormSlotDuration(mins)}
                    style={[
                      styles.durationBtn,
                      formSlotDuration === mins && styles.durationBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.durationText,
                        formSlotDuration === mins && styles.durationTextActive,
                      ]}
                    >
                      {mins}m
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Doctor Biography</Text>
              <TextInput
                style={styles.bioInput}
                placeholder="Write a brief professional summary..."
                placeholderTextColor={Palette.textMuted}
                multiline
                numberOfLines={3}
                value={formAbout}
                onChangeText={setFormAbout}
              />
            </View>

            <View style={styles.formBtnRow}>
              <Button
                title="Cancel"
                variant="outline"
                fullWidth={false}
                onPress={() => setAddModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Enrol Doctor"
                variant="primary"
                fullWidth={false}
                loading={addSubmitting}
                onPress={handleAddDoctorSubmit}
                style={{ flex: 2 }}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      <ConfirmDialog
        visible={deleteConfirmVisible}
        title="Delete Doctor Record?"
        message={`Are you sure you want to delete ${selectedDoctor?.name || "this doctor"}? Historical appointments will be safely retained in your archives.`}
        confirmLabel="Delete Doctor"
        cancelLabel="Keep"
        tone="danger"
        loading={deleting}
        onConfirm={handleDeleteDoctor}
        onCancel={() => setDeleteConfirmVisible(false)}
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
  statsScroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
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
  chipDivider: {
    width: 1,
    height: 20,
    backgroundColor: Palette.border,
    marginHorizontal: Spacing.xs,
  },
  sortSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  sortLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "700",
  },
  sortScroll: {
    gap: Spacing.xs,
  },
  sortChip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surface,
  },
  sortChipActive: {
    backgroundColor: Palette.primaryLight,
  },
  sortChipText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  sortChipTextActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
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
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  modalAvatar: {
    width: 60,
    height: 60,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
  },
  modalHeaderInfo: {
    flex: 1,
    gap: 3,
  },
  modalDoctorName: {
    ...Typography.h3,
    color: Palette.text,
  },
  modalDoctorSub: {
    ...Typography.bodySmall,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  modalHeaderBadges: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: Spacing.xs,
  },
  modalActionsBar: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    flexWrap: "wrap",
  },
  modalTabsBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  modalTab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  modalTabActive: {
    borderBottomColor: Palette.primary,
  },
  modalTabText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  modalTabTextActive: {
    color: Palette.primary,
    fontWeight: "700",
  },
  modalLoadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  modalLoadingText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  tabSection: {
    gap: Spacing.md,
  },
  detailCard: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  infoLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  infoValue: {
    ...Typography.bodySmall,
    color: Palette.text,
  },
  aboutText: {
    ...Typography.bodySmall,
    color: Palette.text,
    lineHeight: 20,
  },
  scheduleList: {
    gap: Spacing.xs,
  },
  scheduleItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  scheduleDay: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
  scheduleHours: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  statsGridRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  smallStatCard: {
    flex: 1,
    padding: Spacing.md,
    alignItems: "center",
    gap: 2,
  },
  smallStatVal: {
    ...Typography.h3,
    color: Palette.text,
  },
  smallStatLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "700",
    fontSize: 10,
  },
  appointmentsList: {
    gap: Spacing.sm,
  },
  appointmentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  appointmentMain: {
    gap: 2,
  },
  patientName: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
  apptTime: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  ratingHeroCard: {
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.xs,
  },
  ratingScore: {
    ...Typography.h1,
    color: Palette.text,
  },
  ratingTotal: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  reviewsList: {
    gap: Spacing.sm,
  },
  reviewItem: {
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
    gap: 4,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewAuthor: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  reviewRatingText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  reviewComment: {
    ...Typography.caption,
    color: Palette.text,
  },
  mutedText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontStyle: "italic",
  },
  formScrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  formSectionHeader: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  fieldWrap: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    ...Typography.label,
    color: Palette.text,
  },
  genderRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: "center",
  },
  genderBtnActive: {
    borderColor: Palette.primary,
    backgroundColor: Palette.primaryLight,
  },
  genderText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
  },
  genderTextActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  deptPickerScroll: {
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  deptPickerChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  deptPickerChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  deptPickerText: {
    ...Typography.caption,
    color: Palette.text,
    fontWeight: "600",
  },
  deptPickerTextActive: {
    color: "#FFF",
  },
  durationRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  durationBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: "center",
  },
  durationBtnActive: {
    borderColor: Palette.primary,
    backgroundColor: Palette.primaryLight,
  },
  durationText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
  },
  durationTextActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  bioInput: {
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
});
