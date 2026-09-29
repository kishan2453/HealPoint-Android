/**
 * HealPoint — Smart Family Health Dashboard & Care Center.
 *
 * Production-ready family health command center:
 *  - Central family care overview & shared consultation quota tracking
 *  - Upcoming family care appointments with direct smart actions
 *  - Individual family member health command cards with real-time care snapshots
 *  - Dedicated member health hub modal with pre-filtered deep-links
 *  - Safe family profile management (CRUD with safe historical data archival)
 *
 * STRICT SAFETY & DATA ISOLATION:
 *  - Independent appointments, prescriptions, reports, follow-ups, and timelines per member.
 *  - Zero data contamination across family members.
 *  - Patient A's information never appears under Patient B.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAppointments } from "@/hooks/use-appointments";
import { useAuth } from "@/hooks/use-auth";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import { formatDDMMYYYY, formatDoctorName } from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import * as familyService from "@/services/family";
import type { Appointment, FamilyMember, FamilyRelationship } from "@/types";

const RELATIONSHIPS: FamilyRelationship[] = [
  "Father",
  "Mother",
  "Spouse",
  "Son",
  "Daughter",
  "Brother",
  "Sister",
  "Other",
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function FamilyHealthDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?._id || "";

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Appointments for upcoming family care tracking
  const { appointments: allAppointments, refetch: refetchAppointments } =
    useAppointments();

  // Selected Member for Health Hub Modal
  const [selectedHubMember, setSelectedHubMember] =
    useState<FamilyMember | null>(null);

  // Add / Edit Member Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [name, setName] = useState("");
  const [relationship, setRelationship] =
    useState<FamilyRelationship>("Mother");
  const [gender, setGender] = useState<"male" | "female" | "other">("female");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [allergies, setAllergies] = useState("");
  const [chronicConditions, setChronicConditions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadDashboardData = useCallback(
    async (isRefresh = false) => {
      if (!userId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const [membersList] = await Promise.all([
          familyService.getFamilyMembers(userId),
          refetchAppointments(),
        ]);
        setMembers(membersList);
      } catch (err) {
        setError(
          toErrorMessage(err, "Failed to load Family Health Dashboard."),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId, refetchAppointments],
  );

  useScreenFocus(loadDashboardData);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Upcoming appointments across all family members
  const upcomingFamilyAppointments = useMemo(() => {
    const now = new Date();
    return allAppointments
      .filter((a) => {
        if (
          a.status === "completed" ||
          a.status === "cancel" ||
          a.status === "missed"
        ) {
          return false;
        }
        const dateStr = a.slotDate || a.date;
        if (!dateStr) return true;
        const apptDate = new Date(dateStr);
        return isNaN(apptDate.getTime()) || apptDate >= now;
      })
      .slice(0, 5);
  }, [allAppointments]);

  // Care counts mapped by memberId
  const memberCareMetrics = useMemo(() => {
    const map = new Map<
      string,
      { totalAppointments: number; nextAppt: Appointment | null }
    >();
    const now = new Date();

    for (const member of members) {
      const memberAppts = allAppointments.filter(
        (a) => a.familyMemberId === member._id,
      );

      const upcoming = memberAppts.filter((a) => {
        if (
          a.status === "completed" ||
          a.status === "cancel" ||
          a.status === "missed"
        ) {
          return false;
        }
        const dateStr = a.slotDate || a.date;
        if (!dateStr) return true;
        const d = new Date(dateStr);
        return isNaN(d.getTime()) || d >= now;
      });

      map.set(member._id, {
        totalAppointments: memberAppts.length,
        nextAppt: upcoming[0] || null,
      });
    }

    return map;
  }, [members, allAppointments]);

  // Modal handlers
  const openAddModal = () => {
    setEditingMember(null);
    setName("");
    setRelationship("Mother");
    setGender("female");
    setDob("");
    setPhone("");
    setBloodGroup("");
    setAllergies("");
    setChronicConditions("");
    setFormError("");
    setModalVisible(true);
  };

  const openEditModal = (member: FamilyMember) => {
    setEditingMember(member);
    setName(member.name);
    setRelationship(member.relationship);
    setGender((member.gender as "male" | "female" | "other") || "female");
    setDob(member.dob || "");
    setPhone(member.phone || "");
    setBloodGroup(member.bloodGroup || "");
    setAllergies((member.allergies || []).join(", "));
    setChronicConditions((member.chronicConditions || []).join(", "));
    setFormError("");
    setModalVisible(true);
  };

  const handleSaveMember = async () => {
    if (!name.trim()) {
      setFormError("Please provide a name for your family member.");
      return;
    }
    if (!userId) {
      setFormError("User authentication session missing.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    const allergiesArray = allergies
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const conditionsArray = chronicConditions
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (editingMember) {
        await familyService.updateFamilyMember(userId, editingMember._id, {
          name: name.trim(),
          relationship,
          gender,
          dob: dob.trim(),
          phone: phone.trim(),
          bloodGroup: bloodGroup.trim(),
          allergies: allergiesArray,
          chronicConditions: conditionsArray,
        });
      } else {
        await familyService.addFamilyMember(userId, {
          name: name.trim(),
          relationship,
          gender,
          dob: dob.trim(),
          phone: phone.trim(),
          bloodGroup: bloodGroup.trim(),
          allergies: allergiesArray,
          chronicConditions: conditionsArray,
        });
      }
      setModalVisible(false);
      loadDashboardData(true);
    } catch (err) {
      setFormError(toErrorMessage(err, "Failed to save family member."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = (member: FamilyMember) => {
    Alert.alert(
      "Remove Family Member",
      `Are you sure you want to remove ${member.name} (${member.relationship})? If past health records exist, their profile will be safely archived to protect medical history.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await familyService.removeFamilyMember(
                userId,
                member._id,
              );
              Alert.alert(
                res.archived ? "Safely Archived" : "Removed",
                res.message,
              );
              loadDashboardData(true);
            } catch (err) {
              Alert.alert(
                "Error",
                toErrorMessage(err, "Failed to remove member."),
              );
            }
          },
        },
      ],
    );
  };

  const getRelationshipColor = (rel: FamilyRelationship) => {
    switch (rel) {
      case "Father":
      case "Mother":
        return "#6366F1";
      case "Spouse":
        return "#EC4899";
      case "Son":
      case "Daughter":
        return "#06B6D4";
      case "Brother":
      case "Sister":
        return "#8B5CF6";
      default:
        return Palette.primary;
    }
  };

  // Helper to resolve patient name for an appointment
  const resolveAppointmentPatientName = (appt: Appointment) => {
    if (appt.familyMemberId) {
      const match = members.find((m) => m._id === appt.familyMemberId);
      if (match) return `${match.name} (${match.relationship})`;
    }
    if (appt.patientName && appt.familyRelationship) {
      return `${appt.patientName} (${appt.familyRelationship})`;
    }
    return user?.name ? `${user.name} (Self)` : "Myself";
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <DrawerToggleButton />
          <View style={styles.headerTitles}>
            <Text style={styles.title}>Family Healthcare</Text>
            <Text style={styles.subtitle}>Smart Family Health Dashboard</Text>
          </View>
        </View>

        <Pressable
          style={styles.addMemberBtn}
          onPress={openAddModal}
          accessibilityRole="button"
          accessibilityLabel="Add Family Member"
        >
          <Ionicons name="person-add" size={16} color="#FFFFFF" />
          <Text style={styles.addMemberBtnText}>Add Member</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDashboardData(true)}
            tintColor={Palette.primary}
          />
        }
      >
        {/* Safety & Quota Hero Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroTitles}>
              <Text style={styles.heroOverline}>
                CENTRAL FAMILY CARE COMMAND
              </Text>
              <Text style={styles.heroTitle}>Family Health Hub</Text>
            </View>
            <View style={styles.heroIconBadge}>
              <Ionicons
                name="shield-checkmark"
                size={26}
                color={Palette.primary}
              />
            </View>
          </View>

          <Text style={styles.heroSubtitle}>
            Manage dependent profiles, book visits on their behalf, and access
            separated records while sharing your primary video consultation
            quota.
          </Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatNumber}>{members.length}</Text>
              <Text style={styles.heroStatLabel}>Family Members</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatNumber}>
                {upcomingFamilyAppointments.length}
              </Text>
              <Text style={styles.heroStatLabel}>Upcoming Visits</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={[styles.heroStatNumber, { color: "#10B981" }]}>
                Active
              </Text>
              <Text style={styles.heroStatLabel}>Quota Sharing</Text>
            </View>
          </View>
        </Card>

        {/* Upcoming Family Care Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Upcoming Family Care</Text>
            <Pressable onPress={() => router.push("/appointments" as never)}>
              <Text style={styles.viewAllLink}>All Visits</Text>
            </Pressable>
          </View>

          {upcomingFamilyAppointments.length === 0 ? (
            <Card style={styles.emptyUpcomingCard}>
              <Ionicons
                name="calendar-outline"
                size={24}
                color={Palette.textMuted}
              />
              <Text style={styles.emptyUpcomingText}>
                No upcoming family appointments scheduled.
              </Text>
              <Pressable
                style={styles.bookFirstVisitBtn}
                onPress={() => router.push("/(drawer)/doctors" as never)}
              >
                <Text style={styles.bookFirstVisitBtnText}>
                  + Book Family Visit
                </Text>
              </Pressable>
            </Card>
          ) : (
            <View style={styles.upcomingList}>
              {upcomingFamilyAppointments.map((appt) => {
                const patientDisplay = resolveAppointmentPatientName(appt);
                const isVideo = appt.consultationType === "video";
                const appointmentId = appt._id || appt.appointmentId;

                return (
                  <Card key={appointmentId} style={styles.upcomingApptCard}>
                    <View style={styles.upcomingCardTop}>
                      <View style={styles.patientBadgeRow}>
                        <View style={styles.patientIconCircle}>
                          <Ionicons
                            name="person"
                            size={12}
                            color={Palette.primary}
                          />
                        </View>
                        <Text style={styles.patientBadgeText} numberOfLines={1}>
                          For: {patientDisplay}
                        </Text>
                      </View>
                      <Badge
                        label={isVideo ? "Video Meet" : "In-Clinic"}
                        variant={isVideo ? "primary" : "neutral"}
                      />
                    </View>

                    <View style={styles.upcomingDoctorRow}>
                      <View style={styles.doctorInfo}>
                        <Text style={styles.doctorName}>
                          {formatDoctorName(appt.doctorName || "Doctor")}
                        </Text>
                        <Text style={styles.doctorSub}>
                          {appt.doctorSpecialty || "Consultation"} •{" "}
                          {appt.hospitalName || "HealPoint Hospital"}
                        </Text>
                        <Text style={styles.slotTimeText}>
                          {formatDDMMYYYY(appt.slotDate || appt.date || "")} at{" "}
                          {appt.slotTime || appt.time || "Scheduled"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.upcomingCardActions}>
                      <Pressable
                        style={styles.detailsActionBtn}
                        onPress={() =>
                          router.push(`/appointment/${appointmentId}` as never)
                        }
                      >
                        <Ionicons
                          name="eye-outline"
                          size={14}
                          color={Palette.primary}
                        />
                        <Text style={styles.detailsActionText}>
                          View Details & Pass
                        </Text>
                      </Pressable>

                      {isVideo && (
                        <Pressable
                          style={styles.joinMeetActionBtn}
                          onPress={() =>
                            router.push(
                              `/consultation/${appointmentId}` as never,
                            )
                          }
                        >
                          <Ionicons name="videocam" size={14} color="#FFFFFF" />
                          <Text style={styles.joinMeetActionText}>
                            Join Consultation
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </View>

        {/* Family Member Cards Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Family Member Profiles</Text>
            <Text style={styles.membersCountBadge}>
              {members.length} Profile{members.length === 1 ? "" : "s"}
            </Text>
          </View>

          {loading && !refreshing ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Palette.primary} />
              <Text style={styles.loadingText}>Loading family profiles...</Text>
            </View>
          ) : error ? (
            <Card style={styles.errorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={24}
                color={Palette.error}
              />
              <Text style={styles.errorText}>{error}</Text>
              <Button
                title="Try Again"
                variant="outline"
                onPress={() => loadDashboardData(true)}
              />
            </Card>
          ) : members.length === 0 ? (
            <EmptyState
              title="No Family Members Added"
              message="Add your parents, children, or spouse to book doctor visits for them and keep their healthcare records properly organized."
              action={
                <Button
                  title="+ Add First Family Member"
                  onPress={openAddModal}
                  style={{ marginTop: Spacing.sm }}
                />
              }
            />
          ) : (
            <View style={styles.membersList}>
              {members.map((member) => {
                const relColor = getRelationshipColor(member.relationship);
                const metrics = memberCareMetrics.get(member._id);
                const nextAppt = metrics?.nextAppt;

                return (
                  <Card key={member._id} style={styles.memberCard}>
                    {/* Header info */}
                    <View style={styles.memberCardHeader}>
                      <View
                        style={[
                          styles.avatarCircle,
                          { backgroundColor: `${relColor}15` },
                        ]}
                      >
                        <Text
                          style={[styles.avatarLetter, { color: relColor }]}
                        >
                          {member.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.memberHeaderContent}>
                        <View style={styles.memberNameRow}>
                          <Text style={styles.memberNameText} numberOfLines={1}>
                            {member.name}
                          </Text>
                          <Badge
                            label={member.relationship}
                            variant="primary"
                            style={{ backgroundColor: `${relColor}18` }}
                          />
                        </View>

                        <View style={styles.memberMetaRow}>
                          {member.gender && (
                            <Text style={styles.memberMetaText}>
                              {member.gender.charAt(0).toUpperCase() +
                                member.gender.slice(1)}
                            </Text>
                          )}
                          {member.gender && member.dob ? (
                            <Text style={styles.metaDot}>•</Text>
                          ) : null}
                          {member.dob ? (
                            <Text style={styles.memberMetaText}>
                              DOB: {member.dob}
                            </Text>
                          ) : null}
                          {member.bloodGroup ? (
                            <>
                              <Text style={styles.metaDot}>•</Text>
                              <Text
                                style={[
                                  styles.memberMetaText,
                                  { color: Palette.error, fontWeight: "600" },
                                ]}
                              >
                                {member.bloodGroup}
                              </Text>
                            </>
                          ) : null}
                        </View>
                      </View>
                    </View>

                    {/* Medical details pills if available */}
                    {((member.chronicConditions &&
                      member.chronicConditions.length > 0) ||
                      (member.allergies && member.allergies.length > 0)) && (
                      <View style={styles.medicalTagsContainer}>
                        {member.chronicConditions?.map((cond, i) => (
                          <View key={`cond-${i}`} style={styles.conditionTag}>
                            <Text style={styles.conditionTagText}>{cond}</Text>
                          </View>
                        ))}
                        {member.allergies?.map((allergy, i) => (
                          <View key={`all-${i}`} style={styles.allergyTag}>
                            <Text style={styles.allergyTagText}>{allergy}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Next Appointment Pill if scheduled */}
                    {nextAppt ? (
                      <View style={styles.nextApptPill}>
                        <Ionicons name="calendar" size={14} color="#2F80ED" />
                        <Text style={styles.nextApptText} numberOfLines={1}>
                          Next:{" "}
                          {formatDoctorName(nextAppt.doctorName || "Doctor")} on{" "}
                          {nextAppt.slotDate || nextAppt.date}
                        </Text>
                      </View>
                    ) : null}

                    {/* Metrics snapshot */}
                    <View style={styles.memberMetricsRow}>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricNumber}>
                          {metrics?.totalAppointments ?? 0}
                        </Text>
                        <Text style={styles.metricLabel}>Total Visits</Text>
                      </View>
                      <View style={styles.metricDivider} />
                      <View style={styles.metricItem}>
                        <Text style={styles.metricNumber}>Isolated</Text>
                        <Text style={styles.metricLabel}>Medical Vault</Text>
                      </View>
                      <View style={styles.metricDivider} />
                      <View style={styles.metricItem}>
                        <Text
                          style={[styles.metricNumber, { color: "#10B981" }]}
                        >
                          Shared
                        </Text>
                        <Text style={styles.metricLabel}>Video Quota</Text>
                      </View>
                    </View>

                    {/* Actions row */}
                    <View style={styles.memberCardActions}>
                      <Pressable
                        style={styles.openHubBtn}
                        onPress={() => setSelectedHubMember(member)}
                      >
                        <Ionicons name="medical" size={15} color="#FFFFFF" />
                        <Text style={styles.openHubBtnText}>Health Hub</Text>
                      </Pressable>

                      <Pressable
                        style={styles.bookMemberBtn}
                        onPress={() =>
                          router.push({
                            pathname: "/(drawer)/doctors" as never,
                            params: { memberId: member._id },
                          })
                        }
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={15}
                          color={Palette.primary}
                        />
                        <Text style={styles.bookMemberBtnText}>Book Visit</Text>
                      </Pressable>

                      <Pressable
                        style={styles.iconActionBtn}
                        onPress={() => openEditModal(member)}
                        accessibilityRole="button"
                        accessibilityLabel="Edit Member"
                      >
                        <Ionicons
                          name="pencil-outline"
                          size={18}
                          color={Palette.text}
                        />
                      </Pressable>

                      <Pressable
                        style={styles.iconActionBtn}
                        onPress={() => handleRemoveMember(member)}
                        accessibilityRole="button"
                        accessibilityLabel="Remove Member"
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={Palette.error}
                        />
                      </Pressable>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Member Care Hub Detail Modal */}
      <Modal
        visible={Boolean(selectedHubMember)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedHubMember(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.hubModalContainer}>
            {selectedHubMember && (
              <>
                <View style={styles.hubModalHeader}>
                  <View style={styles.hubHeaderInfo}>
                    <Text style={styles.hubModalTitle}>
                      {selectedHubMember.name}
                    </Text>
                    <Badge
                      label={selectedHubMember.relationship}
                      variant="primary"
                      style={{
                        backgroundColor: `${getRelationshipColor(selectedHubMember.relationship)}18`,
                      }}
                    />
                  </View>
                  <Pressable
                    onPress={() => setSelectedHubMember(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Close Care Hub"
                  >
                    <Ionicons name="close" size={24} color={Palette.text} />
                  </Pressable>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.hubModalBody}
                >
                  {/* Clinical overview banner */}
                  <View style={styles.hubClinicalBanner}>
                    <Text style={styles.hubClinicalTitle}>
                      Member Clinical Profile
                    </Text>
                    <View style={styles.hubClinicalGrid}>
                      <View style={styles.hubClinicalItem}>
                        <Text style={styles.hubClinicalLabel}>Blood Group</Text>
                        <Text
                          style={[
                            styles.hubClinicalValue,
                            { color: Palette.error },
                          ]}
                        >
                          {selectedHubMember.bloodGroup || "Not recorded"}
                        </Text>
                      </View>
                      <View style={styles.hubClinicalItem}>
                        <Text style={styles.hubClinicalLabel}>
                          Date of Birth
                        </Text>
                        <Text style={styles.hubClinicalValue}>
                          {selectedHubMember.dob || "Not recorded"}
                        </Text>
                      </View>
                      <View style={styles.hubClinicalItem}>
                        <Text style={styles.hubClinicalLabel}>Contact</Text>
                        <Text style={styles.hubClinicalValue}>
                          {selectedHubMember.phone || "Account holder"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Connected Care Subsystems Navigation */}
                  <Text style={styles.hubSectionHeading}>
                    Connected Healthcare Vaults
                  </Text>
                  <Text style={styles.hubSectionSub}>
                    Access {selectedHubMember.name}&apos;s isolated health
                    milestones and clinical records.
                  </Text>

                  <View style={styles.hubLinksGrid}>
                    <Pressable
                      style={styles.hubLinkTile}
                      onPress={() => {
                        setSelectedHubMember(null);
                        router.push({
                          pathname: "/appointments" as never,
                          params: { memberId: selectedHubMember._id },
                        });
                      }}
                    >
                      <View
                        style={[
                          styles.hubLinkIcon,
                          { backgroundColor: "#EEF2FF" },
                        ]}
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={20}
                          color="#4F46E5"
                        />
                      </View>
                      <Text style={styles.hubLinkText}>Appointments</Text>
                    </Pressable>

                    <Pressable
                      style={styles.hubLinkTile}
                      onPress={() => {
                        setSelectedHubMember(null);
                        router.push({
                          pathname: "/(drawer)/health/prescriptions" as never,
                          params: { memberId: selectedHubMember._id },
                        });
                      }}
                    >
                      <View
                        style={[
                          styles.hubLinkIcon,
                          { backgroundColor: "#ECFDF5" },
                        ]}
                      >
                        <Ionicons
                          name="medical-outline"
                          size={20}
                          color="#10B981"
                        />
                      </View>
                      <Text style={styles.hubLinkText}>
                        Prescriptions & Reminders
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.hubLinkTile}
                      onPress={() => {
                        setSelectedHubMember(null);
                        router.push({
                          pathname: "/(drawer)/health/records" as never,
                          params: { memberId: selectedHubMember._id },
                        });
                      }}
                    >
                      <View
                        style={[
                          styles.hubLinkIcon,
                          { backgroundColor: "#F3E8FF" },
                        ]}
                      >
                        <Ionicons
                          name="folder-open-outline"
                          size={20}
                          color="#7C3AED"
                        />
                      </View>
                      <Text style={styles.hubLinkText}>EMR Records</Text>
                    </Pressable>

                    <Pressable
                      style={styles.hubLinkTile}
                      onPress={() => {
                        setSelectedHubMember(null);
                        router.push({
                          pathname: "/(drawer)/health/reports" as never,
                          params: { memberId: selectedHubMember._id },
                        });
                      }}
                    >
                      <View
                        style={[
                          styles.hubLinkIcon,
                          { backgroundColor: "#E0F2FE" },
                        ]}
                      >
                        <Ionicons
                          name="bar-chart-outline"
                          size={20}
                          color="#0284C7"
                        />
                      </View>
                      <Text style={styles.hubLinkText}>Lab Reports</Text>
                    </Pressable>

                    <Pressable
                      style={styles.hubLinkTile}
                      onPress={() => {
                        setSelectedHubMember(null);
                        router.push({
                          pathname: "/(drawer)/health/follow-ups" as never,
                          params: { memberId: selectedHubMember._id },
                        });
                      }}
                    >
                      <View
                        style={[
                          styles.hubLinkIcon,
                          { backgroundColor: "#FFF7ED" },
                        ]}
                      >
                        <Ionicons
                          name="refresh-outline"
                          size={20}
                          color="#EA580C"
                        />
                      </View>
                      <Text style={styles.hubLinkText}>Follow-Ups</Text>
                    </Pressable>

                    <Pressable
                      style={styles.hubLinkTile}
                      onPress={() => {
                        setSelectedHubMember(null);
                        router.push({
                          pathname: "/(drawer)/health/timeline" as never,
                          params: { memberId: selectedHubMember._id },
                        });
                      }}
                    >
                      <View
                        style={[
                          styles.hubLinkIcon,
                          { backgroundColor: "#F0FDF4" },
                        ]}
                      >
                        <Ionicons
                          name="time-outline"
                          size={20}
                          color={Palette.primary}
                        />
                      </View>
                      <Text style={styles.hubLinkText}>Health Timeline</Text>
                    </Pressable>

                    <Pressable
                      style={styles.hubLinkTile}
                      onPress={() => {
                        setSelectedHubMember(null);
                        router.push({
                          pathname: "/(drawer)/health-wallet" as never,
                          params: { memberId: selectedHubMember._id },
                        });
                      }}
                    >
                      <View
                        style={[
                          styles.hubLinkIcon,
                          { backgroundColor: "#FDF2F8" },
                        ]}
                      >
                        <Ionicons
                          name="wallet-outline"
                          size={20}
                          color="#DB2777"
                        />
                      </View>
                      <Text style={styles.hubLinkText}>Digital Wallet</Text>
                    </Pressable>

                    <Pressable
                      style={styles.hubLinkTile}
                      onPress={() => {
                        setSelectedHubMember(null);
                        router.push({
                          pathname: "/(drawer)/health/goals" as never,
                          params: { memberId: selectedHubMember._id },
                        });
                      }}
                    >
                      <View
                        style={[
                          styles.hubLinkIcon,
                          { backgroundColor: "#EFF6FF" },
                        ]}
                      >
                        <Ionicons
                          name="trophy-outline"
                          size={20}
                          color="#2F80ED"
                        />
                      </View>
                      <Text style={styles.hubLinkText}>Health Goals</Text>
                    </Pressable>
                  </View>

                  <Button
                    title={`+ Book Visit for ${selectedHubMember.name}`}
                    onPress={() => {
                      setSelectedHubMember(null);
                      router.push({
                        pathname: "/(drawer)/doctors" as never,
                        params: { memberId: selectedHubMember._id },
                      });
                    }}
                    style={{ marginTop: Spacing.md }}
                  />
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Add / Edit Family Member Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingMember ? "Edit Family Member" : "Add Family Member"}
              </Text>
              <Pressable
                onPress={() => setModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close Modal"
              >
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.formScrollBody}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.formLabel}>Full Name *</Text>
              <TextInput
                style={styles.formInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Sarah Jenkins"
                placeholderTextColor={Palette.textMuted}
              />

              <Text style={styles.formLabel}>Relationship *</Text>
              <View style={styles.relationshipGrid}>
                {RELATIONSHIPS.map((rel) => {
                  const isSelected = relationship === rel;
                  return (
                    <Pressable
                      key={rel}
                      style={[
                        styles.relChip,
                        isSelected && styles.relChipSelected,
                      ]}
                      onPress={() => setRelationship(rel)}
                    >
                      <Text
                        style={[
                          styles.relChipText,
                          isSelected && styles.relChipTextSelected,
                        ]}
                      >
                        {rel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.formLabel}>Gender</Text>
              <View style={styles.genderRow}>
                {(["female", "male", "other"] as const).map((g) => {
                  const isSelected = gender === g;
                  return (
                    <Pressable
                      key={g}
                      style={[
                        styles.genderChip,
                        isSelected && styles.genderChipSelected,
                      ]}
                      onPress={() => setGender(g)}
                    >
                      <Text
                        style={[
                          styles.genderChipText,
                          isSelected && styles.genderChipTextSelected,
                        ]}
                      >
                        {g.charAt(0).toUpperCase() + g.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.formLabel}>Date of Birth (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.formInput}
                value={dob}
                onChangeText={setDob}
                placeholder="e.g., 1985-06-15"
                placeholderTextColor={Palette.textMuted}
              />

              <Text style={styles.formLabel}>Phone Number (Optional)</Text>
              <TextInput
                style={styles.formInput}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="e.g., +91 9876543210"
                placeholderTextColor={Palette.textMuted}
              />

              <Text style={styles.formLabel}>Blood Group</Text>
              <View style={styles.bloodGrid}>
                {BLOOD_GROUPS.map((bg) => {
                  const isSelected = bloodGroup === bg;
                  return (
                    <Pressable
                      key={bg}
                      style={[
                        styles.bloodChip,
                        isSelected && styles.bloodChipSelected,
                      ]}
                      onPress={() => setBloodGroup(isSelected ? "" : bg)}
                    >
                      <Text
                        style={[
                          styles.bloodChipText,
                          isSelected && styles.bloodChipTextSelected,
                        ]}
                      >
                        {bg}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.formLabel}>
                Chronic Conditions (Comma separated)
              </Text>
              <TextInput
                style={styles.formInput}
                value={chronicConditions}
                onChangeText={setChronicConditions}
                placeholder="e.g., Diabetes Type 2, Hypertension"
                placeholderTextColor={Palette.textMuted}
              />

              <Text style={styles.formLabel}>Allergies (Comma separated)</Text>
              <TextInput
                style={styles.formInput}
                value={allergies}
                onChangeText={setAllergies}
                placeholder="e.g., Penicillin, Peanuts"
                placeholderTextColor={Palette.textMuted}
              />

              {formError ? (
                <Text style={styles.formErrorText}>{formError}</Text>
              ) : null}

              <View style={styles.modalActionButtonsRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setModalVisible(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title={editingMember ? "Save Changes" : "Add Member"}
                  loading={submitting}
                  onPress={handleSaveMember}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerTitles: {
    marginLeft: Spacing.xs,
  },
  title: {
    ...Typography.h3,
    color: Palette.text,
  },
  subtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  addMemberBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
  addMemberBtnText: {
    ...Typography.label,
    color: "#FFFFFF",
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  heroCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    ...Shadows.sm,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  heroTitles: {
    flex: 1,
  },
  heroOverline: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primary,
    letterSpacing: 0.5,
  },
  heroTitle: {
    ...Typography.h2,
    color: Palette.text,
  },
  heroIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${Palette.primary}12`,
    alignItems: "center",
    justifyContent: "center",
  },
  heroSubtitle: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 20,
    marginTop: 4,
  },
  heroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  heroStatItem: {
    flex: 1,
    alignItems: "center",
  },
  heroStatNumber: {
    ...Typography.h3,
    color: Palette.text,
  },
  heroStatLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  heroStatDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: Palette.border,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  viewAllLink: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.primary,
  },
  membersCountBadge: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  emptyUpcomingCard: {
    padding: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    backgroundColor: Palette.surface,
  },
  emptyUpcomingText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    textAlign: "center",
  },
  bookFirstVisitBtn: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: `${Palette.primary}12`,
  },
  bookFirstVisitBtnText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.primary,
  },
  upcomingList: {
    gap: Spacing.sm,
  },
  upcomingApptCard: {
    padding: Spacing.md,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    gap: Spacing.xs,
  },
  upcomingCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  patientBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  patientIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: `${Palette.primary}18`,
    alignItems: "center",
    justifyContent: "center",
  },
  patientBadgeText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
    flex: 1,
  },
  upcomingDoctorRow: {
    marginTop: 4,
  },
  doctorInfo: {
    gap: 2,
  },
  doctorName: {
    ...Typography.bodyMedium,
    fontWeight: "600",
    color: Palette.text,
  },
  doctorSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  slotTimeText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
    marginTop: 2,
  },
  upcomingCardActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs + 2,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  detailsActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: `${Palette.primary}10`,
  },
  detailsActionText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.primary,
  },
  joinMeetActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: "#10B981",
  },
  joinMeetActionText: {
    ...Typography.caption,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  loadingBox: {
    padding: Spacing.xxl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  errorBox: {
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.sm,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Palette.error,
    textAlign: "center",
  },
  membersList: {
    gap: Spacing.md,
  },
  memberCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    ...Shadows.sm,
    gap: Spacing.sm,
  },
  memberCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: "700",
  },
  memberHeaderContent: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  memberNameText: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
    flex: 1,
  },
  memberMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  memberMetaText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  metaDot: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  medicalTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  conditionTag: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  conditionTagText: {
    fontSize: 11,
    color: Palette.text,
    fontWeight: "500",
  },
  allergyTag: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  allergyTagText: {
    fontSize: 11,
    color: "#B91C1C",
    fontWeight: "500",
  },
  nextApptPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  nextApptText: {
    ...Typography.caption,
    fontWeight: "600",
    color: "#1E40AF",
    flex: 1,
  },
  memberMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Palette.background,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  metricNumber: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
  },
  metricLabel: {
    fontSize: 10,
    color: Palette.textMuted,
    marginTop: 1,
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    backgroundColor: Palette.border,
  },
  memberCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  openHubBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Palette.primary,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  openHubBtnText: {
    ...Typography.caption,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  bookMemberBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: `${Palette.primary}12`,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  bookMemberBtnText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primary,
  },
  iconActionBtn: {
    padding: 8,
    borderRadius: Radius.sm,
  },
  bottomSpacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
  },
  hubModalContainer: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "85%",
    paddingBottom: Spacing.xxl,
  },
  hubModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  hubHeaderInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  hubModalTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  hubModalBody: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  hubClinicalBanner: {
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  hubClinicalTitle: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
    marginBottom: Spacing.xs,
  },
  hubClinicalGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  hubClinicalItem: {
    flex: 1,
  },
  hubClinicalLabel: {
    fontSize: 10,
    color: Palette.textMuted,
  },
  hubClinicalValue: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
    marginTop: 2,
  },
  hubSectionHeading: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  hubSectionSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: -4,
  },
  hubLinksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  hubLinkTile: {
    width: "48.5%",
    backgroundColor: Palette.surface,
    padding: Spacing.sm + 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: "center",
    gap: 6,
  },
  hubLinkIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  hubLinkText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
    textAlign: "center",
  },
  editModalContainer: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "90%",
    paddingBottom: Spacing.xxl,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  modalTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  formScrollBody: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  formLabel: {
    ...Typography.label,
    color: Palette.textMuted,
    marginTop: 4,
  },
  formInput: {
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    color: Palette.text,
  },
  relationshipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  relChip: {
    backgroundColor: Palette.background,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  relChipSelected: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  relChipText: {
    ...Typography.caption,
    color: Palette.text,
    fontWeight: "500",
  },
  relChipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  genderRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  genderChip: {
    flex: 1,
    alignItems: "center",
    backgroundColor: Palette.background,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  genderChipSelected: {
    backgroundColor: `${Palette.primary}15`,
    borderColor: Palette.primary,
  },
  genderChipText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
  },
  genderChipTextSelected: {
    color: Palette.primaryDark,
  },
  bloodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  bloodChip: {
    width: "22%",
    alignItems: "center",
    backgroundColor: Palette.background,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  bloodChipSelected: {
    backgroundColor: "#FEE2E2",
    borderColor: "#EF4444",
  },
  bloodChipText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
  },
  bloodChipTextSelected: {
    color: "#DC2626",
    fontWeight: "700",
  },
  formErrorText: {
    ...Typography.caption,
    color: Palette.error,
    marginTop: 4,
  },
  modalActionButtonsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
