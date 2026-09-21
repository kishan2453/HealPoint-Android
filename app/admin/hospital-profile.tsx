/**
 * HealPoint - Hospital Admin · Facility Profile.
 * Full production-grade hospital facility profile management:
 * - Scoped strictly to logged-in Hospital Admin's facility via /hospital-admin/profile
 * - Profile Completeness meter (% calculation & missing fields reminder)
 * - Real facility statistics: Doctors, Departments, Services, Bookings
 * - 4 structured tabs: Overview & Facilities, Contact & Location, Departments & Services, Operating Hours
 * - Interactive chips editor for Departments & Services (add / remove chips)
 * - Day-wise operating schedule (Monday through Sunday)
 * - Real API sync via PUT /hospital-admin/profile
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { toErrorMessage } from "@/services/api";
import * as adminService from "@/services/admin";
import type { Hospital } from "@/types";

type ProfileTab = "overview" | "contact" | "services" | "hours";

const HOSPITAL_TYPES = [
  "Multi-Specialty",
  "General Hospital",
  "Super Specialty",
  "Clinic",
  "Maternity & Children",
  "Cardiac Center",
  "Eye Hospital",
  "Diagnostic & Surgical",
];

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function HospitalAdminProfileScreen() {
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [stats, setStats] = useState<adminService.HospitalProfileStats | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successBanner, setSuccessBanner] = useState("");
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");

  // Form Fields: Overview
  const [name, setName] = useState("");
  const [hospitalType, setHospitalType] = useState("Multi-Specialty");
  const [about, setAbout] = useState("");
  const [opdTimings, setOpdTimings] = useState("");
  const [beds, setBeds] = useState("");
  const [icuBeds, setIcuBeds] = useState("");
  const [emergencyFacility, setEmergencyFacility] = useState(true);

  // Form Fields: Contact & Location
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  const [email, setEmail] = useState("");
  const [receptionPhone, setReceptionPhone] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [website, setWebsite] = useState("");

  // Form Fields: Departments & Services Chips
  const [departmentsList, setDepartmentsList] = useState<string[]>([]);
  const [newDeptInput, setNewDeptInput] = useState("");
  const [servicesList, setServicesList] = useState<string[]>([]);
  const [newServiceInput, setNewServiceInput] = useState("");

  // Form Fields: Operating Hours
  const [operatingHours, setOperatingHours] = useState<
    Record<
      string,
      { open: string; close: string; is24x7: boolean; closed: boolean }
    >
  >(() => {
    const initial: Record<
      string,
      { open: string; close: string; is24x7: boolean; closed: boolean }
    > = {};
    WEEK_DAYS.forEach((day) => {
      initial[day] = {
        open: "08:00 AM",
        close: "08:00 PM",
        is24x7: false,
        closed: day === "Sunday",
      };
    });
    return initial;
  });

  // Load Profile from API
  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let h: Hospital | null = null;
      let s: adminService.HospitalProfileStats | null = null;

      try {
        const res = await adminService.getHospitalProfile();
        h = res.hospital;
        s = res.stats;
      } catch {
        // Fallback to getHospitalAdminDashboard
        const dash = await adminService.getHospitalAdminDashboard();
        h = dash.hospital || null;
      }

      if (h) {
        setHospital(h);
        setName(h.name || "");
        setAbout(h.about || "");
        setOpdTimings(h.opdTimings || "Mon - Sat: 08:00 AM - 08:00 PM");
        setBeds(h.beds ? String(h.beds) : "");
        setIcuBeds(h.icuBeds ? String(h.icuBeds) : "");
        setEmergencyFacility(h.emergencyFacility !== false);

        if (h.location) {
          setAddress(h.location.address || "");
          setCity(h.location.city || "");
          setStateName(h.location.state || "");
          setPincode(h.location.pincode || "");
        }

        if (h.contact) {
          setEmail(h.contact.email || "");
          setReceptionPhone(h.contact.reception || "");
          setEmergencyPhone(h.contact.emergency || "");
          setWebsite(h.contact.website || "");
        }

        setDepartmentsList(
          h.departments || ["Cardiology", "Orthopedics", "Pediatrics"],
        );
        setServicesList(
          h.services || [
            "24x7 Emergency",
            "Pharmacy",
            "Diagnostics",
            "Ambulance",
          ],
        );

        if ((h as any).hospitalType) {
          setHospitalType((h as any).hospitalType);
        }

        if ((h as any).operatingHours) {
          setOperatingHours((prev) => ({
            ...prev,
            ...(h as any).operatingHours,
          }));
        }
      }

      if (s) {
        setStats(s);
      } else if (h) {
        setStats({
          doctorCount: h.doctorCount ?? h.doctors?.length ?? 0,
          departmentCount: h.departments?.length ?? 0,
          servicesCount: h.services?.length ?? 0,
          appointmentCount: h.appointmentCount ?? 0,
          completeness: 85,
        });
      }
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load hospital profile."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Compute live completeness score
  const completeness = useMemo(() => {
    const fields = [
      Boolean(name.trim()),
      Boolean(about.trim()),
      Boolean(opdTimings.trim()),
      Boolean(address.trim()),
      Boolean(city.trim()),
      Boolean(pincode.trim()),
      Boolean(receptionPhone.trim()),
      Boolean(email.trim()),
      departmentsList.length > 0,
      servicesList.length > 0,
      Boolean(beds.trim()),
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }, [
    name,
    about,
    opdTimings,
    address,
    city,
    pincode,
    receptionPhone,
    email,
    departmentsList,
    servicesList,
    beds,
  ]);

  // Department chip handlers
  const handleAddDepartment = () => {
    const trimmed = newDeptInput.trim();
    if (!trimmed) return;
    if (
      !departmentsList.some((d) => d.toLowerCase() === trimmed.toLowerCase())
    ) {
      setDepartmentsList([...departmentsList, trimmed]);
    }
    setNewDeptInput("");
  };

  const handleRemoveDepartment = (dept: string) => {
    setDepartmentsList(departmentsList.filter((d) => d !== dept));
  };

  // Service chip handlers
  const handleAddService = () => {
    const trimmed = newServiceInput.trim();
    if (!trimmed) return;
    if (!servicesList.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setServicesList([...servicesList, trimmed]);
    }
    setNewServiceInput("");
  };

  const handleRemoveService = (service: string) => {
    setServicesList(servicesList.filter((s) => s !== service));
  };

  // Operating Hours updater
  const updateDayHours = (
    day: string,
    key: "open" | "close" | "is24x7" | "closed",
    value: string | boolean,
  ) => {
    setOperatingHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [key]: value,
      },
    }));
  };

  // Save changes
  const handleSave = async () => {
    setSaving(true);
    setSuccessBanner("");
    try {
      const payload = {
        name: name.trim(),
        hospitalType,
        about: about.trim(),
        opdTimings: opdTimings.trim(),
        beds: beds ? parseInt(beds, 10) : undefined,
        icuBeds: icuBeds ? parseInt(icuBeds, 10) : undefined,
        emergencyFacility,
        location: {
          address: address.trim(),
          city: city.trim(),
          state: stateName.trim(),
          pincode: pincode.trim(),
        },
        contact: {
          email: email.trim().toLowerCase(),
          reception: receptionPhone.trim(),
          emergency: emergencyPhone.trim(),
          website: website.trim(),
        },
        departments: departmentsList,
        services: servicesList,
        operatingHours,
      };

      await adminService.updateHospitalProfile(payload);
      setSuccessBanner("Hospital facility profile updated successfully!");
      setTimeout(() => setSuccessBanner(""), 4000);
      void loadProfile();
    } catch (err) {
      Alert.alert(
        "Error",
        toErrorMessage(err, "Failed to save hospital profile."),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModuleScreen
      title="Hospital Profile"
      subtitle="Public healthcare facility & operational setup"
      allowedRoles={["admin"]}
      loading={loading}
      error={error}
      onRetry={loadProfile}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Banner Message */}
          {successBanner ? (
            <View style={styles.bannerWrap}>
              <FormMessage type="success" message={successBanner} />
            </View>
          ) : null}

          {/* Facility Header Card */}
          <Card style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View style={styles.hospitalLogoWrap}>
                <Ionicons
                  name="business"
                  size={32}
                  color={Palette.primaryDark}
                />
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.hospitalName} numberOfLines={1}>
                  {hospital?.name || name || "Hospital Facility"}
                </Text>
                <Text style={styles.hospitalTypeSub} numberOfLines={1}>
                  {hospitalType} · {city || hospital?.location?.city || "India"}
                </Text>
                <View style={styles.headerBadges}>
                  <Badge
                    label={
                      hospital?.isActive !== false
                        ? "Active Facility"
                        : "Inactive"
                    }
                    variant={
                      hospital?.isActive !== false ? "success" : "neutral"
                    }
                  />
                  {emergencyFacility ? (
                    <Badge label="24x7 Emergency" variant="primary" />
                  ) : null}
                </View>
              </View>
            </View>

            {/* Profile Completeness Meter */}
            <View style={styles.completenessWrap}>
              <View style={styles.completenessHeader}>
                <Text style={styles.completenessLabel}>
                  Profile Completeness
                </Text>
                <Text style={styles.completenessVal}>{completeness}%</Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(100, Math.max(5, completeness))}%`,
                      backgroundColor:
                        completeness >= 80
                          ? Palette.success
                          : completeness >= 50
                            ? Palette.warning
                            : Palette.error,
                    },
                  ]}
                />
              </View>
              {completeness < 100 ? (
                <Text style={styles.completenessHint}>
                  Complete all contact and facility details to maximize patient
                  discovery.
                </Text>
              ) : null}
            </View>
          </Card>

          {/* Facility Real Stats */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsScroll}
          >
            <StatCard
              label="Doctors Enrolled"
              value={stats?.doctorCount ?? hospital?.doctorCount ?? 0}
              icon="people"
              accent={Palette.primary}
              hint="Active medical officers"
            />
            <StatCard
              label="Departments"
              value={departmentsList.length}
              icon="business"
              accent={Palette.info}
              hint="Clinical wings"
            />
            <StatCard
              label="Services"
              value={servicesList.length}
              icon="medkit"
              accent={Palette.success}
              hint="Offered capabilities"
            />
            <StatCard
              label="Total Bookings"
              value={stats?.appointmentCount ?? hospital?.appointmentCount ?? 0}
              icon="calendar"
              accent={Palette.warning}
              hint="All-time appointments"
            />
          </ScrollView>

          {/* Tab Navigation */}
          <View style={styles.tabsBar}>
            {(
              [
                { id: "overview", label: "Overview" },
                { id: "contact", label: "Contact" },
                { id: "services", label: "Services" },
                { id: "hours", label: "Hours" },
              ] as const
            ).map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setActiveTab(t.id)}
                style={[
                  styles.tabBtn,
                  activeTab === t.id && styles.tabBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === t.id && styles.tabTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* ======================================================= */}
          {/* TAB 1: OVERVIEW & FACILITY                              */}
          {/* ======================================================= */}
          {activeTab === "overview" ? (
            <Card style={styles.formCard}>
              <Text style={styles.sectionHeader}>
                GENERAL FACILITY INFORMATION
              </Text>

              <Input
                label="Hospital Legal Name *"
                placeholder="e.g. Apollo Super Speciality Hospital"
                value={name}
                onChangeText={setName}
                leftIcon="business-outline"
              />

              {/* Hospital Type Chips */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Facility Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.typeChipsScroll}
                >
                  {HOSPITAL_TYPES.map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setHospitalType(t)}
                      style={[
                        styles.typeChip,
                        hospitalType === t && styles.typeChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          hospitalType === t && styles.typeChipTextActive,
                        ]}
                      >
                        {t}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <Input
                label="OPD Timings"
                placeholder="e.g. Mon - Sat: 08:00 AM - 08:00 PM"
                value={opdTimings}
                onChangeText={setOpdTimings}
                leftIcon="time-outline"
              />

              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Total Inpatient Beds"
                    placeholder="e.g. 150"
                    keyboardType="number-pad"
                    value={beds}
                    onChangeText={setBeds}
                    leftIcon="bed-outline"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="ICU Beds"
                    placeholder="e.g. 25"
                    keyboardType="number-pad"
                    value={icuBeds}
                    onChangeText={setIcuBeds}
                    leftIcon="pulse-outline"
                  />
                </View>
              </View>

              {/* Emergency Switch */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.switchTitle}>
                    24x7 Emergency Services
                  </Text>
                  <Text style={styles.switchSub}>
                    Enables round-the-clock emergency admission badge on public
                    profile
                  </Text>
                </View>
                <Pressable
                  onPress={() => setEmergencyFacility(!emergencyFacility)}
                  style={[
                    styles.toggleBtn,
                    emergencyFacility && styles.toggleBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      emergencyFacility && styles.toggleTextActive,
                    ]}
                  >
                    {emergencyFacility ? "ACTIVE" : "OFF"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>About Hospital Facility</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Describe your hospital, specialized medical care, accreditations (NABH/JCI), and mission..."
                  placeholderTextColor={Palette.textMuted}
                  multiline
                  numberOfLines={4}
                  value={about}
                  onChangeText={setAbout}
                />
              </View>
            </Card>
          ) : null}

          {/* ======================================================= */}
          {/* TAB 2: CONTACT & LOCATION                               */}
          {/* ======================================================= */}
          {activeTab === "contact" ? (
            <Card style={styles.formCard}>
              <Text style={styles.sectionHeader}>
                FACILITY LOCATION & HOTLINES
              </Text>

              <Input
                label="Street Address *"
                placeholder="e.g. Plot 12, Medical Square, Ring Road"
                value={address}
                onChangeText={setAddress}
                leftIcon="location-outline"
              />

              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="City *"
                    placeholder="e.g. Mumbai"
                    value={city}
                    onChangeText={setCity}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="State"
                    placeholder="e.g. Maharashtra"
                    value={stateName}
                    onChangeText={setStateName}
                  />
                </View>
              </View>

              <Input
                label="Postal Pincode *"
                placeholder="e.g. 400001"
                keyboardType="number-pad"
                value={pincode}
                onChangeText={setPincode}
              />

              <Input
                label="Official Hospital Email *"
                placeholder="info@hospital.org"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                leftIcon="mail-outline"
              />

              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Reception Hotline *"
                    placeholder="022-12345678"
                    keyboardType="phone-pad"
                    value={receptionPhone}
                    onChangeText={setReceptionPhone}
                    leftIcon="call-outline"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Emergency Number"
                    placeholder="1066 / 9876543210"
                    keyboardType="phone-pad"
                    value={emergencyPhone}
                    onChangeText={setEmergencyPhone}
                    leftIcon="alert-circle-outline"
                  />
                </View>
              </View>

              <Input
                label="Hospital Website"
                placeholder="https://www.hospital.org"
                keyboardType="url"
                autoCapitalize="none"
                value={website}
                onChangeText={setWebsite}
                leftIcon="globe-outline"
              />
            </Card>
          ) : null}

          {/* ======================================================= */}
          {/* TAB 3: DEPARTMENTS & SERVICES CHIPS                     */}
          {/* ======================================================= */}
          {activeTab === "services" ? (
            <Card style={styles.formCard}>
              <Text style={styles.sectionHeader}>CLINICAL DEPARTMENTS</Text>
              <Text style={styles.sectionSub}>
                Specialties listed on your public portal. Doctors are assigned
                to these wings.
              </Text>

              <View style={styles.chipsContainer}>
                {departmentsList.map((dept) => (
                  <View key={dept} style={styles.chipPill}>
                    <Text style={styles.chipPillText}>{dept}</Text>
                    <Pressable
                      onPress={() => handleRemoveDepartment(dept)}
                      hitSlop={6}
                      style={styles.chipRemoveBtn}
                    >
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color={Palette.primaryDark}
                      />
                    </Pressable>
                  </View>
                ))}
              </View>

              <View style={styles.addChipRow}>
                <TextInput
                  style={styles.chipInput}
                  placeholder="Add specialty (e.g. Oncology, Neurology)..."
                  placeholderTextColor={Palette.textMuted}
                  value={newDeptInput}
                  onChangeText={setNewDeptInput}
                  onSubmitEditing={handleAddDepartment}
                />
                <Button
                  title="Add"
                  fullWidth={false}
                  variant="primary"
                  onPress={handleAddDepartment}
                />
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionHeader}>
                FACILITY SERVICES & AMENITIES
              </Text>
              <Text style={styles.sectionSub}>
                Hospital facilities highlighted to patients (ICU, Pharmacy,
                Dialysis, etc.)
              </Text>

              <View style={styles.chipsContainer}>
                {servicesList.map((srv) => (
                  <View key={srv} style={[styles.chipPill, styles.servicePill]}>
                    <Text style={[styles.chipPillText, styles.servicePillText]}>
                      {srv}
                    </Text>
                    <Pressable
                      onPress={() => handleRemoveService(srv)}
                      hitSlop={6}
                      style={styles.chipRemoveBtn}
                    >
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color={Palette.info}
                      />
                    </Pressable>
                  </View>
                ))}
              </View>

              <View style={styles.addChipRow}>
                <TextInput
                  style={styles.chipInput}
                  placeholder="Add facility (e.g. Blood Bank, MRI)..."
                  placeholderTextColor={Palette.textMuted}
                  value={newServiceInput}
                  onChangeText={setNewServiceInput}
                  onSubmitEditing={handleAddService}
                />
                <Button
                  title="Add"
                  fullWidth={false}
                  variant="primary"
                  onPress={handleAddService}
                />
              </View>
            </Card>
          ) : null}

          {/* ======================================================= */}
          {/* TAB 4: OPERATING HOURS                                  */}
          {/* ======================================================= */}
          {activeTab === "hours" ? (
            <Card style={styles.formCard}>
              <Text style={styles.sectionHeader}>WEEKLY OPERATING HOURS</Text>
              <Text style={styles.sectionSub}>
                General hospital operation schedule shown to public visitors.
              </Text>

              <View style={styles.hoursTable}>
                {WEEK_DAYS.map((day) => {
                  const schedule = operatingHours[day] || {
                    open: "08:00 AM",
                    close: "08:00 PM",
                    is24x7: false,
                    closed: false,
                  };

                  return (
                    <View key={day} style={styles.dayRow}>
                      <View style={styles.dayCol}>
                        <Text style={styles.dayName}>{day}</Text>
                        <Text style={styles.dayStatus}>
                          {schedule.closed
                            ? "Closed"
                            : schedule.is24x7
                              ? "Open 24x7"
                              : `${schedule.open} - ${schedule.close}`}
                        </Text>
                      </View>

                      <View style={styles.dayActions}>
                        <Pressable
                          onPress={() =>
                            updateDayHours(day, "closed", !schedule.closed)
                          }
                          style={[
                            styles.hourToggle,
                            schedule.closed && styles.hourToggleClosed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.hourToggleText,
                              schedule.closed && styles.hourToggleClosedText,
                            ]}
                          >
                            {schedule.closed ? "CLOSED" : "OPEN"}
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() =>
                            updateDayHours(day, "is24x7", !schedule.is24x7)
                          }
                          disabled={schedule.closed}
                          style={[
                            styles.hourToggle,
                            schedule.is24x7 && styles.hourToggle24,
                            schedule.closed && { opacity: 0.4 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.hourToggleText,
                              schedule.is24x7 && styles.hourToggle24Text,
                            ]}
                          >
                            24h
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          ) : null}

          {/* Save Profile Button Bar */}
          <View style={styles.saveWrap}>
            <Button
              title="Save Facility Profile"
              icon="checkmark-circle-outline"
              variant="primary"
              loading={saving}
              onPress={handleSave}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  bannerWrap: {
    paddingTop: Spacing.sm,
  },
  headerCard: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  hospitalLogoWrap: {
    width: 60,
    height: 60,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
    gap: 3,
  },
  hospitalName: {
    ...Typography.h3,
    color: Palette.text,
  },
  hospitalTypeSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  headerBadges: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: 2,
  },
  completenessWrap: {
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  completenessHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  completenessLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  completenessVal: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: Palette.background,
    borderRadius: Radius.pill,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: Radius.pill,
  },
  completenessHint: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  statsScroll: {
    gap: Spacing.md,
  },
  tabsBar: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: Radius.sm,
  },
  tabBtnActive: {
    backgroundColor: Palette.primary,
  },
  tabText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  tabTextActive: {
    color: "#FFF",
    fontWeight: "700",
  },
  formCard: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionHeader: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  sectionSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: -Spacing.xs,
  },
  fieldWrap: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    ...Typography.label,
    color: Palette.text,
  },
  typeChipsScroll: {
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  typeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  typeChipActive: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
  typeChipText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  typeChipTextActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  twoColRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  switchTitle: {
    ...Typography.label,
    color: Palette.text,
  },
  switchSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    paddingRight: Spacing.md,
  },
  toggleBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  toggleBtnActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  toggleText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  toggleTextActive: {
    color: "#FFF",
  },
  textArea: {
    minHeight: 100,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Typography.bodySmall,
    color: Palette.text,
    textAlignVertical: "top",
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  chipPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Palette.primaryLight,
    borderWidth: 1,
    borderColor: Palette.primary,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  chipPillText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  servicePill: {
    backgroundColor: "#E7F1FE",
    borderColor: Palette.info,
  },
  servicePillText: {
    color: Palette.info,
  },
  chipRemoveBtn: {
    padding: 1,
  },
  addChipRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
  },
  chipInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Palette.surface,
    ...Typography.bodySmall,
    color: Palette.text,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.border,
    marginVertical: Spacing.sm,
  },
  hoursTable: {
    gap: Spacing.sm,
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  dayCol: {
    gap: 2,
  },
  dayName: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  dayStatus: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  dayActions: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  hourToggle: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  hourToggleClosed: {
    backgroundColor: "#FDECEC",
    borderColor: Palette.error,
  },
  hourToggleClosedText: {
    color: Palette.error,
    fontWeight: "700",
  },
  hourToggle24: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
  hourToggle24Text: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  hourToggleText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  saveWrap: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
});
