/**
 * Family Healthcare & Family Member Management Service.
 *
 * Allows account holders to manage family profiles, book appointments for
 * dependents, and maintain separate medical timelines while sharing centralized
 * subscription consultation quotas.
 */
import * as SecureStore from "expo-secure-store";
import { api } from "./api";
import { getUserAppointments } from "./appointments";
import type {
  FamilyMember,
  FamilyRelationship,
} from "@/types";

const STORAGE_PREFIX = "healpoint_family_members_";

export interface CreateFamilyMemberPayload {
  name: string;
  relationship: FamilyRelationship;
  gender?: "male" | "female" | "other" | string;
  dob?: string;
  phone?: string;
  bloodGroup?: string;
  allergies?: string[];
  chronicConditions?: string[];
  image?: string;
}

export interface UpdateFamilyMemberPayload {
  name?: string;
  relationship?: FamilyRelationship;
  gender?: "male" | "female" | "other" | string;
  dob?: string;
  phone?: string;
  bloodGroup?: string;
  allergies?: string[];
  chronicConditions?: string[];
  image?: string;
  isArchived?: boolean;
}

function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

async function loadLocalMembers(userId: string): Promise<FamilyMember[]> {
  try {
    const raw = await SecureStore.getItemAsync(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveLocalMembers(
  userId: string,
  members: FamilyMember[],
): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      getStorageKey(userId),
      JSON.stringify(members),
    );
  } catch (err) {
    console.warn("Failed to persist family members to SecureStore:", err);
  }
}

/**
 * Fetch all family members belonging to the current user.
 * By default, filters out archived members unless includeArchived is true.
 */
export async function getFamilyMembers(
  userId: string,
  includeArchived = false,
): Promise<FamilyMember[]> {
  if (!userId) return [];

  let members: FamilyMember[] = [];

  // 1. Try remote API first
  try {
    const res = await api.get<{
      success: boolean;
      familyMembers?: FamilyMember[];
      data?: FamilyMember[];
    }>(`/user/family-members/${userId}`, { auth: true });

    if (res?.success) {
      members = res.familyMembers || res.data || [];
      // Sync local cache
      await saveLocalMembers(userId, members);
    } else {
      members = await loadLocalMembers(userId);
    }
  } catch {
    // 2. Fallback to resilient SecureStore cache
    members = await loadLocalMembers(userId);
  }

  if (includeArchived) {
    return members;
  }
  return members.filter((m) => !m.isArchived);
}

/**
 * Fetch a single family member by ID.
 */
export async function getFamilyMemberById(
  userId: string,
  memberId: string,
): Promise<FamilyMember | null> {
  const members = await getFamilyMembers(userId, true);
  return members.find((m) => m._id === memberId) || null;
}

/**
 * Add a new family member.
 */
export async function addFamilyMember(
  userId: string,
  payload: CreateFamilyMemberPayload,
): Promise<FamilyMember> {
  if (!userId) throw new Error("User ID is required to add a family member");
  if (!payload.name?.trim()) throw new Error("Family member name is required");
  if (!payload.relationship) throw new Error("Relationship is required");

  const newMember: FamilyMember = {
    _id: `fam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    name: payload.name.trim(),
    relationship: payload.relationship,
    gender: payload.gender || "other",
    dob: payload.dob || "",
    phone: payload.phone || "",
    bloodGroup: payload.bloodGroup || "",
    allergies: payload.allergies || [],
    chronicConditions: payload.chronicConditions || [],
    image: payload.image || "",
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Attempt backend persistence
  try {
    const res = await api.post<{
      success: boolean;
      familyMember?: FamilyMember;
      data?: FamilyMember;
    }>(`/user/family-members/${userId}`, payload, { auth: true });

    if (res?.success && (res.familyMember || res.data)) {
      const serverMember = res.familyMember || res.data!;
      const existing = await loadLocalMembers(userId);
      const updated = [serverMember, ...existing.filter((m) => m._id !== serverMember._id)];
      await saveLocalMembers(userId, updated);
      return serverMember;
    }
  } catch {
    // Ignore and fallback to local persistence
  }

  // Local persistence
  const existing = await loadLocalMembers(userId);
  const updated = [newMember, ...existing];
  await saveLocalMembers(userId, updated);
  return newMember;
}

/**
 * Update an existing family member.
 */
export async function updateFamilyMember(
  userId: string,
  memberId: string,
  payload: UpdateFamilyMemberPayload,
): Promise<FamilyMember> {
  if (!userId || !memberId) {
    throw new Error("Missing userId or memberId");
  }

  const existing = await loadLocalMembers(userId);
  const index = existing.findIndex((m) => m._id === memberId);
  if (index === -1) {
    throw new Error("Family member not found");
  }

  const current = existing[index];
  const updatedMember: FamilyMember = {
    ...current,
    ...payload,
    name: payload.name !== undefined ? payload.name.trim() : current.name,
    updatedAt: new Date().toISOString(),
  };

  // Attempt remote update
  try {
    await api.patch(
      `/user/family-members/${userId}/${memberId}`,
      payload,
      { auth: true },
    );
  } catch {
    // Continue with local update
  }

  existing[index] = updatedMember;
  await saveLocalMembers(userId, existing);
  return updatedMember;
}

/**
 * Remove or archive a family member.
 * Safe Deletion: If historical appointments exist for this member, they are
 * archived (`isArchived: true`) instead of hard deleted, preserving patient history.
 */
export async function removeFamilyMember(
  userId: string,
  memberId: string,
): Promise<{ success: boolean; archived: boolean; message: string }> {
  if (!userId || !memberId) {
    throw new Error("Missing userId or memberId");
  }

  // Check historical appointments
  let hasHistoricalRecords = false;
  try {
    const appointmentsRes = await getUserAppointments(userId);
    const appointments = appointmentsRes?.appoinmtent || [];
    hasHistoricalRecords = appointments.some(
      (apt) => apt.familyMemberId === memberId,
    );
  } catch {
    // If appointment check fails, default to safe archive
    hasHistoricalRecords = true;
  }

  const existing = await loadLocalMembers(userId);

  if (hasHistoricalRecords) {
    // Safe Archive
    const updated = existing.map((m) =>
      m._id === memberId ? { ...m, isArchived: true, updatedAt: new Date().toISOString() } : m,
    );
    await saveLocalMembers(userId, updated);

    try {
      await api.delete(`/user/family-members/${userId}/${memberId}?archive=true`, {
        auth: true,
      });
    } catch {
      // Ignored
    }

    return {
      success: true,
      archived: true,
      message: "Family member has historical health records and was safely archived.",
    };
  }

  // Hard delete if no records ever existed
  const updated = existing.filter((m) => m._id !== memberId);
  await saveLocalMembers(userId, updated);

  try {
    await api.delete(`/user/family-members/${userId}/${memberId}`, {
      auth: true,
    });
  } catch {
    // Ignored
  }

  return {
    success: true,
    archived: false,
    message: "Family member removed successfully.",
  };
}

