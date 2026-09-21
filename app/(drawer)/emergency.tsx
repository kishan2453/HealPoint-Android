/**
 * HealPoint - Smart Emergency Assistance.
 *
 * Provides rapid, calm, and reliable access to verified emergency hospital desks,
 * on-site ambulance services, national medical helplines, and personal emergency contacts.
 *
 * 100% Real Canonical Data: Directly connected to accredited emergency hospitals
 * in Ahmedabad, Gujarat. Strictly an assistance/navigation service — never provides
 * automated medical diagnosis or triage.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { resolveHospitalImage } from "@/lib/image";
import { getEmergencyHospitals } from "@/services/hospitals";
import type { Hospital } from "@/types";

type FilterTab = "all" | "ambulance" | "icu";

export default function EmergencyScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [error, setError] = useState<string | null>(null);

  const fetchHospitals = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await getEmergencyHospitals();
      if (response?.hospitals) {
        setHospitals(response.hospitals);
      } else {
        setHospitals([]);
      }
    } catch {
      setError(
        "Unable to load emergency hospitals directory. Please check network connection.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHospitals();
  }, [fetchHospitals]);

  // Direct Phone Dialing Handler
  const callNumber = (phone: string, label: string) => {
    const cleaned = phone.replace(/[^0-9+]/g, "");
    if (!cleaned) {
      Alert.alert(
        "No Number",
        `A valid phone number is not listed for ${label}.`,
      );
      return;
    }

    Alert.alert(
      "Place Emergency Call",
      `Dial ${label} (${phone}) now?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call Now",
          style: "default",
          onPress: () => {
            Linking.openURL(`tel:${cleaned}`).catch(() => {
              Alert.alert(
                "Call Failed",
                `Unable to open device phone dialer for ${phone}.`,
              );
            });
          },
        },
      ],
      { cancelable: true },
    );
  };

  // Open Directions in Native Maps
  const openDirections = (hospital: Hospital) => {
    if (hospital.location?.mapsUrl) {
      Linking.openURL(hospital.location.mapsUrl).catch(() => {
        const query = encodeURIComponent(
          `${hospital.name} ${hospital.location?.address || ""} ${hospital.location?.city || ""}`,
        );
        Linking.openURL(
          `https://www.google.com/maps/search/?api=1&query=${query}`,
        );
      });
    } else {
      const query = encodeURIComponent(
        `${hospital.name} ${hospital.location?.address || ""} ${hospital.location?.city || ""}`,
      );
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${query}`,
      );
    }
  };

  // Safe Native Sharing of Hospital Emergency Information (Zero Private Data)
  const shareEmergencyInfo = async (hospital: Hospital) => {
    const address = [
      hospital.location?.address,
      hospital.location?.city,
      hospital.location?.state,
    ]
      .filter(Boolean)
      .join(", ");
    const emergencyNum =
      hospital.contact?.emergency ||
      hospital.contact?.reception ||
      "Not listed";
    const receptionNum = hospital.contact?.reception || "Not listed";

    const text = [
      `HealPoint Emergency Assistance Directory`,
      `Hospital: ${hospital.name}`,
      `24/7 Emergency Hotline: ${emergencyNum}`,
      `Hospital Reception: ${receptionNum}`,
      address ? `Address: ${address}` : "",
      hospital.location?.mapsUrl
        ? `Maps Location: ${hospital.location.mapsUrl}`
        : "",
      `\nNational Medical Emergency: 108 | Central Helpline: 112`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await Share.share({
        title: `${hospital.name} - Emergency Details`,
        message: text,
      });
    } catch {
      // User dismissed share sheet
    }
  };

  // Filtered Hospital List
  const filteredHospitals = useMemo(() => {
    let list = hospitals;

    if (activeTab === "ambulance") {
      list = list.filter(
        (h) =>
          h.facilitiesInfo?.ambulance ||
          /ambulance/i.test(h.services?.join(" ") || ""),
      );
    } else if (activeTab === "icu") {
      list = list.filter(
        (h) => h.icu || h.facilitiesInfo?.icu || (h.icuBeds || 0) > 0,
      );
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter((h) => {
        const nameMatch = h.name?.toLowerCase().includes(query);
        const cityMatch = h.location?.city?.toLowerCase().includes(query);
        const addressMatch = h.location?.address?.toLowerCase().includes(query);
        const deptMatch = (h.departments || []).some((d) =>
          d.toLowerCase().includes(query),
        );
        return nameMatch || cityMatch || addressMatch || deptMatch;
      });
    }

    return list;
  }, [hospitals, activeTab, searchQuery]);

  const emergencyContact = user?.emergencyContact;
  const hasEmergencyContact = Boolean(
    emergencyContact?.name && emergencyContact?.phone,
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Top Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/(drawer)")
            }
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={Palette.text} />
          </Pressable>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>Emergency Help</Text>
              <View style={styles.liveIndicator}>
                <View style={styles.livePulseDot} />
                <Text style={styles.liveText}>24/7 ACTIVE</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              Verified hospital emergency desks & hotlines
            </Text>
          </View>
        </View>
        <DrawerToggleButton color={Palette.text} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchHospitals(true)}
            colors={[Palette.primary]}
            tintColor={Palette.primary}
          />
        }
      >
        {/* National Emergency Helplines Quick Dial */}
        <Card style={styles.nationalHelplineCard}>
          <View style={styles.helplineHeader}>
            <View style={styles.helplineBadge}>
              <Ionicons name="shield-checkmark" size={16} color="#B91C1C" />
              <Text style={styles.helplineBadgeText}>
                NATIONAL TOLL-FREE HELPLINES
              </Text>
            </View>
            <Text style={styles.helplineCaption}>
              Immediate ambulance & disaster response
            </Text>
          </View>

          <View style={styles.helplineButtonsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Call 108 Medical Ambulance"
              onPress={() =>
                callNumber("108", "Medical Ambulance Service (108)")
              }
              style={({ pressed }) => [
                styles.helplineBtn,
                styles.helplineBtnPrimary,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.helplineIconCircle}>
                <Ionicons name="call" size={18} color={Palette.white} />
              </View>
              <View style={styles.helplineBtnTextWrap}>
                <Text style={styles.helplineNumberPrimary}>108</Text>
                <Text style={styles.helplineLabelPrimary}>
                  Ambulance & Trauma
                </Text>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Call 112 National Emergency"
              onPress={() =>
                callNumber("112", "National Emergency Services (112)")
              }
              style={({ pressed }) => [
                styles.helplineBtn,
                styles.helplineBtnSecondary,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.helplineIconCircle,
                  styles.helplineIconSecondary,
                ]}
              >
                <Ionicons name="call" size={18} color="#991B1B" />
              </View>
              <View style={styles.helplineBtnTextWrap}>
                <Text style={styles.helplineNumberSecondary}>112</Text>
                <Text style={styles.helplineLabelSecondary}>
                  Central Emergency
                </Text>
              </View>
            </Pressable>
          </View>
        </Card>

        {/* Safety & Medical Guidance Notice */}
        <View style={styles.disclaimerBanner}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={Palette.primaryDark}
            style={styles.disclaimerIcon}
          />
          <Text style={styles.disclaimerText}>
            <Text style={styles.disclaimerBold}>
              Navigation & Contact Directory:{" "}
            </Text>
            HealPoint provides direct navigation and verified contacts to
            accredited hospital emergency departments. For critical,
            life-threatening conditions, dial 108 or proceed to the nearest
            emergency room immediately.
          </Text>
        </View>

        {/* Patient Personal Emergency Contact Card */}
        <Card style={styles.contactCard}>
          <View style={styles.contactCardHeader}>
            <View style={styles.contactIconWrap}>
              <Ionicons name="people" size={20} color={Palette.primaryDark} />
            </View>
            <View style={styles.contactCardTitleWrap}>
              <Text style={styles.contactCardTitle}>
                Personal Emergency Contact
              </Text>
              <Text style={styles.contactCardSub}>
                Trusted person to notify in medical urgency
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit emergency contact"
              onPress={() => router.push("/profile/edit")}
              style={({ pressed }) => [
                styles.editContactButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="pencil" size={14} color={Palette.primaryDark} />
              <Text style={styles.editContactText}>
                {hasEmergencyContact ? "Edit" : "Add"}
              </Text>
            </Pressable>
          </View>

          {hasEmergencyContact ? (
            <View style={styles.configuredContactBody}>
              <View style={styles.contactDetails}>
                <Text style={styles.contactName}>{emergencyContact?.name}</Text>
                <View style={styles.contactMetaRow}>
                  {emergencyContact?.relation ? (
                    <Badge
                      variant="neutral"
                      label={emergencyContact.relation}
                    />
                  ) : null}
                  <Text style={styles.contactPhone}>
                    {emergencyContact?.phone}
                  </Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Call ${emergencyContact?.name}`}
                onPress={() =>
                  callNumber(
                    emergencyContact?.phone || "",
                    emergencyContact?.name || "Emergency Contact",
                  )
                }
                style={({ pressed }) => [
                  styles.callContactButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="call" size={16} color={Palette.white} />
                <Text style={styles.callContactText}>Call Contact</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyContactBody}>
              <Text style={styles.emptyContactText}>
                No personal emergency contact added yet. Save a family member or
                friend in your profile for rapid 1-tap contact.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/profile/edit")}
                style={({ pressed }) => [
                  styles.addContactPill,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="add-circle"
                  size={16}
                  color={Palette.primaryDark}
                />
                <Text style={styles.addContactPillText}>
                  Configure Contact in Profile
                </Text>
              </Pressable>
            </View>
          )}
        </Card>

        {/* Section Heading & Search */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Accredited Emergency Desks</Text>
            <Text style={styles.sectionSubtitle}>
              {filteredHospitals.length} emergency hospital
              {filteredHospitals.length === 1 ? "" : "s"} available in Ahmedabad
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBarWrap}>
          <Ionicons
            name="search"
            size={18}
            color={Palette.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search hospital name or area..."
            placeholderTextColor={Palette.textMuted}
            style={styles.searchInput}
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <Ionicons
                name="close-circle"
                size={18}
                color={Palette.textMuted}
              />
            </Pressable>
          ) : null}
        </View>

        {/* Filter Chips */}
        <View style={styles.filterTabsRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setActiveTab("all")}
            style={[
              styles.filterChip,
              activeTab === "all" && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                activeTab === "all" && styles.filterChipTextActive,
              ]}
            >
              All Centers ({hospitals.length})
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setActiveTab("ambulance")}
            style={[
              styles.filterChip,
              activeTab === "ambulance" && styles.filterChipActive,
            ]}
          >
            <Ionicons
              name="car-outline"
              size={14}
              color={
                activeTab === "ambulance" ? Palette.white : Palette.primaryDark
              }
            />
            <Text
              style={[
                styles.filterChipText,
                activeTab === "ambulance" && styles.filterChipTextActive,
              ]}
            >
              Ambulance Ready
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setActiveTab("icu")}
            style={[
              styles.filterChip,
              activeTab === "icu" && styles.filterChipActive,
            ]}
          >
            <Ionicons
              name="pulse-outline"
              size={14}
              color={activeTab === "icu" ? Palette.white : Palette.primaryDark}
            />
            <Text
              style={[
                styles.filterChipText,
                activeTab === "icu" && styles.filterChipTextActive,
              ]}
            >
              ICU Available
            </Text>
          </Pressable>
        </View>

        {/* Loading / Error States */}
        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color={Palette.primary} />
            <Text style={styles.stateTitle}>
              Loading verified emergency centers…
            </Text>
          </View>
        ) : error ? (
          <Card style={styles.errorCard}>
            <Ionicons name="alert-circle" size={32} color={Palette.error} />
            <Text style={styles.errorTitle}>{error}</Text>
            <Button
              title="Retry"
              onPress={() => fetchHospitals()}
              variant="outline"
              style={{ marginTop: Spacing.sm }}
            />
          </Card>
        ) : filteredHospitals.length === 0 ? (
          <Card style={styles.stateBox}>
            <Ionicons
              name="medical-outline"
              size={36}
              color={Palette.textMuted}
            />
            <Text style={styles.emptyTitle}>
              No matching emergency centers found
            </Text>
            <Text style={styles.emptySub}>
              Try searching with a broader keyword or resetting filters.
            </Text>
            <Button
              title="Reset Filters"
              onPress={() => {
                setSearchQuery("");
                setActiveTab("all");
              }}
              variant="outline"
              style={{ marginTop: Spacing.md }}
            />
          </Card>
        ) : (
          /* List of Emergency Hospital Cards */
          <View style={styles.hospitalsList}>
            {filteredHospitals.map((hospital) => {
              const emergencyPhone =
                hospital.contact?.emergency || hospital.contact?.phone || "";
              const receptionPhone =
                hospital.contact?.reception || hospital.contact?.phone || "";
              const hasAmbulance = hospital.facilitiesInfo?.ambulance ?? true;
              const hasIcu = hospital.icu || (hospital.icuBeds || 0) > 0;
              const address = [
                hospital.location?.address,
                hospital.location?.city,
              ]
                .filter(Boolean)
                .join(", ");

              return (
                <Card key={hospital._id} style={styles.hospitalCard}>
                  {/* Hospital Info Header */}
                  <View style={styles.hospitalHeaderRow}>
                    <Image
                      source={{ uri: resolveHospitalImage(hospital) }}
                      style={styles.hospitalLogo}
                      contentFit="cover"
                      transition={150}
                    />
                    <View style={styles.hospitalInfo}>
                      <View style={styles.hospitalBadgesRow}>
                        <View style={styles.emergencyBadge}>
                          <View style={styles.pulseDotRed} />
                          <Text style={styles.emergencyBadgeText}>
                            24/7 Trauma Ready
                          </Text>
                        </View>
                        {hasAmbulance ? (
                          <View style={styles.ambulanceBadge}>
                            <Ionicons name="car" size={11} color="#047857" />
                            <Text style={styles.ambulanceBadgeText}>
                              Ambulance
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.hospitalName} numberOfLines={2}>
                        {hospital.name}
                      </Text>

                      <View style={styles.locationRow}>
                        <Ionicons
                          name="location-outline"
                          size={14}
                          color={Palette.textMuted}
                        />
                        <Text style={styles.locationText} numberOfLines={1}>
                          {address || "Ahmedabad, Gujarat"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Highlights Bar */}
                  <View style={styles.highlightsBar}>
                    <View style={styles.highlightItem}>
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color={Palette.primaryDark}
                      />
                      <Text style={styles.highlightText}>
                        {hospital.opdTimings || "24x7 Emergency Desk"}
                      </Text>
                    </View>
                    {hasIcu ? (
                      <View style={styles.highlightItem}>
                        <Ionicons
                          name="bed-outline"
                          size={14}
                          color={Palette.primaryDark}
                        />
                        <Text style={styles.highlightText}>
                          {hospital.icuBeds
                            ? `${hospital.icuBeds} ICU Beds`
                            : "ICU Facility"}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Primary Action Buttons */}
                  <View style={styles.actionButtonsContainer}>
                    {/* Direct Call Emergency Hotline */}
                    {emergencyPhone ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Call 24/7 Emergency at ${hospital.name}`}
                        onPress={() =>
                          callNumber(
                            emergencyPhone,
                            `${hospital.name} - 24/7 Emergency`,
                          )
                        }
                        style={({ pressed }) => [
                          styles.emergencyCallBtn,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Ionicons name="call" size={17} color={Palette.white} />
                        <View style={styles.callBtnTextWrap}>
                          <Text style={styles.emergencyCallBtnTitle}>
                            Call Emergency Desk
                          </Text>
                          <Text style={styles.emergencyCallBtnPhone}>
                            {emergencyPhone}
                          </Text>
                        </View>
                      </Pressable>
                    ) : null}

                    {/* Secondary Actions Row */}
                    <View style={styles.secondaryActionsRow}>
                      {receptionPhone ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Call Reception at ${hospital.name}`}
                          onPress={() =>
                            callNumber(
                              receptionPhone,
                              `${hospital.name} - Reception`,
                            )
                          }
                          style={({ pressed }) => [
                            styles.secondaryActionBtn,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Ionicons
                            name="call-outline"
                            size={15}
                            color={Palette.text}
                          />
                          <Text style={styles.secondaryActionText}>
                            Reception
                          </Text>
                        </Pressable>
                      ) : null}

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Get directions to ${hospital.name}`}
                        onPress={() => openDirections(hospital)}
                        style={({ pressed }) => [
                          styles.secondaryActionBtn,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Ionicons
                          name="navigate-outline"
                          size={15}
                          color={Palette.primaryDark}
                        />
                        <Text
                          style={[
                            styles.secondaryActionText,
                            { color: Palette.primaryDark },
                          ]}
                        >
                          Directions
                        </Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Share emergency details for ${hospital.name}`}
                        onPress={() => shareEmergencyInfo(hospital)}
                        style={({ pressed }) => [
                          styles.secondaryActionBtn,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Ionicons
                          name="share-social-outline"
                          size={15}
                          color={Palette.textMuted}
                        />
                        <Text style={styles.secondaryActionText}>Share</Text>
                      </Pressable>
                    </View>

                    {/* Navigation Links Row */}
                    <View style={styles.footerLinksRow}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          router.push({
                            pathname: "/hospital/[id]",
                            params: { id: String(hospital._id) },
                          })
                        }
                        style={({ pressed }) => [
                          styles.footerLink,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.footerLinkText}>
                          View Hospital Details
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={13}
                          color={Palette.primaryDark}
                        />
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          router.push({
                            pathname: "/doctors",
                            params: { hospitalId: String(hospital._id) },
                          })
                        }
                        style={({ pressed }) => [
                          styles.footerLink,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.footerLinkText}>
                          Available Doctors
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={13}
                          color={Palette.primaryDark}
                        />
                      </Pressable>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  headerTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#DC2626",
  },
  liveText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#B91C1C",
    letterSpacing: 0.4,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  nationalHelplineCard: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  helplineHeader: {
    gap: 2,
  },
  helplineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  helplineBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#991B1B",
    letterSpacing: 0.5,
  },
  helplineCaption: {
    ...Typography.caption,
    color: "#7F1D1D",
  },
  helplineButtonsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  helplineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  helplineBtnPrimary: {
    backgroundColor: "#DC2626",
  },
  helplineBtnSecondary: {
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  helplineIconCircle: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  helplineIconSecondary: {
    backgroundColor: "#FEE2E2",
  },
  helplineBtnTextWrap: {
    flex: 1,
  },
  helplineNumberPrimary: {
    fontSize: 18,
    fontWeight: "800",
    color: Palette.white,
  },
  helplineLabelPrimary: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
  helplineNumberSecondary: {
    fontSize: 18,
    fontWeight: "800",
    color: "#991B1B",
  },
  helplineLabelSecondary: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7F1D1D",
  },
  disclaimerBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Palette.primaryLight,
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: Palette.primaryDark,
  },
  disclaimerIcon: {
    marginTop: 1,
  },
  disclaimerText: {
    ...Typography.bodySmall,
    color: Palette.primaryDark,
    flex: 1,
    lineHeight: 18,
  },
  disclaimerBold: {
    fontWeight: "700",
  },
  contactCard: {
    backgroundColor: Palette.surface,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  contactCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  contactIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  contactCardTitleWrap: {
    flex: 1,
  },
  contactCardTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  contactCardSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  editContactButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
  },
  editContactText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.primaryDark,
  },
  configuredContactBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  contactDetails: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    ...Typography.h4,
    color: Palette.text,
  },
  contactMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  contactPhone: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  callContactButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Palette.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    ...Shadows.sm,
  },
  callContactText: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.white,
  },
  emptyContactBody: {
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  emptyContactText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  addContactPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: Palette.primaryLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
  },
  addContactPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  sectionHeaderRow: {
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  sectionSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === "ios" ? Spacing.sm : 6,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.sm,
  },
  searchIcon: {
    marginRight: 2,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Palette.text,
    padding: 0,
  },
  filterTabsRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    flexWrap: "wrap",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  filterChipActive: {
    backgroundColor: Palette.primaryDark,
    borderColor: Palette.primaryDark,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  filterChipTextActive: {
    color: Palette.white,
  },
  hospitalsList: {
    gap: Spacing.md,
  },
  hospitalCard: {
    backgroundColor: Palette.surface,
    padding: Spacing.md,
    gap: Spacing.md,
    borderRadius: Radius.lg,
  },
  hospitalHeaderRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  hospitalLogo: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
  },
  hospitalInfo: {
    flex: 1,
    gap: 4,
  },
  hospitalBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  emergencyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  pulseDotRed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#DC2626",
  },
  emergencyBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#B91C1C",
  },
  ambulanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  ambulanceBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
  },
  hospitalName: {
    ...Typography.h4,
    color: Palette.text,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    ...Typography.caption,
    color: Palette.textMuted,
    flex: 1,
  },
  highlightsBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.background,
    paddingVertical: 8,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    gap: Spacing.md,
  },
  highlightItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  highlightText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  actionButtonsContainer: {
    gap: Spacing.sm,
  },
  emergencyCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DC2626",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  callBtnTextWrap: {
    flex: 1,
  },
  emergencyCallBtnTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Palette.white,
  },
  emergencyCallBtnPhone: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.92)",
  },
  secondaryActionsRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: Radius.md,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.text,
  },
  footerLinksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  footerLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 2,
  },
  footerLinkText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.primaryDark,
  },
  stateBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  stateTitle: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  errorCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.xs,
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },
  errorTitle: {
    ...Typography.bodySmall,
    color: Palette.error,
    textAlign: "center",
  },
  emptyTitle: {
    ...Typography.h4,
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  emptySub: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    textAlign: "center",
  },
  bottomSpacer: {
    height: 40,
  },
  pressed: {
    opacity: 0.8,
  },
});
