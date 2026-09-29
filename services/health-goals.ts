/**
 * HealPoint — Smart Health Goals & Wellness Progress Service.
 *
 * Production-ready health goal management with Expo SecureStore local resilience.
 * Derives factual progress metrics strictly from real patient data:
 * appointments, medication reminders, follow-ups, and health records.
 */

import * as SecureStore from "expo-secure-store";
import { api, ApiClientError } from "./api";
import type {
  CreateHealthGoalPayload,
  HealthGoal,
  HealthGoalsResponse,
  HealthGoalStatus,
  UpdateHealthGoalPayload,
} from "@/types";

const STORAGE_KEY_PREFIX = "healpoint_health_goals_";

function getStorageKey(userId: string): string {
  // Sanitize key for SecureStore (alphanumeric, ".", "-", "_")
  const sanitized = userId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${STORAGE_KEY_PREFIX}${sanitized}`;
}

function generateLocalId(): string {
  return `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadLocalGoals(userId: string): Promise<HealthGoal[]> {
  try {
    const data = await SecureStore.getItemAsync(getStorageKey(userId));
    if (data) {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? (parsed as HealthGoal[]) : [];
    }
  } catch (err) {
    console.warn("Failed to load local health goals:", err);
  }
  return [];
}

async function saveLocalGoals(
  userId: string,
  goals: HealthGoal[],
): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      getStorageKey(userId),
      JSON.stringify(goals),
    );
  } catch (err) {
    console.warn("Failed to save local health goals:", err);
  }
}

function shouldFallbackToLocal(err: unknown): boolean {
  if (err instanceof ApiClientError) {
    return err.category === "NOT_FOUND" || err.category === "NETWORK";
  }
  return true;
}

export async function getHealthGoals(
  userId: string,
  params?: { familyMemberId?: string; status?: HealthGoalStatus },
): Promise<HealthGoalsResponse> {
  try {
    const queryParts: string[] = [];
    if (params?.familyMemberId && params.familyMemberId !== "all") {
      queryParts.push(
        `familyMemberId=${encodeURIComponent(params.familyMemberId)}`,
      );
    }
    if (params?.status) {
      queryParts.push(`status=${encodeURIComponent(params.status)}`);
    }
    const query = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";

    const res = await api.get<HealthGoalsResponse>(
      `/appointment/patient/health-goals${query}`,
      {
        auth: true,
        timeout: 10000,
      },
    );
    if (res && res.goals) {
      // Also cache locally for offline access
      await saveLocalGoals(userId, res.goals);
      return res;
    }
    throw new Error("Invalid backend response");
  } catch (err) {
    if (shouldFallbackToLocal(err)) {
      const allGoals = await loadLocalGoals(userId);
      let filteredGoals = allGoals;

      if (params?.familyMemberId && params.familyMemberId !== "all") {
        if (params.familyMemberId === "self") {
          filteredGoals = filteredGoals.filter(
            (g) => !g.familyMemberId || g.familyMemberId === "self",
          );
        } else {
          filteredGoals = filteredGoals.filter(
            (g) => g.familyMemberId === params.familyMemberId,
          );
        }
      }

      if (params?.status) {
        filteredGoals = filteredGoals.filter((g) => g.status === params.status);
      }

      const stats = {
        total: allGoals.length,
        active: allGoals.filter((g) => g.status === "active").length,
        completed: allGoals.filter((g) => g.status === "completed").length,
        paused: allGoals.filter((g) => g.status === "paused").length,
      };

      return {
        success: true,
        goals: filteredGoals,
        stats,
        patient: {
          _id: userId,
          name: "",
        },
      };
    }
    throw err;
  }
}

export async function createHealthGoal(
  userId: string,
  payload: CreateHealthGoalPayload,
): Promise<{ success: boolean; message?: string; goal: HealthGoal }> {
  try {
    const response = await api.post<{
      success: boolean;
      message?: string;
      goal: HealthGoal;
    }>("/appointment/patient/health-goals", payload, {
      auth: true,
      timeout: 10000,
    });
    if (response?.goal) {
      // Keep local sync
      const goals = await loadLocalGoals(userId);
      goals.unshift(response.goal);
      await saveLocalGoals(userId, goals);
      return response;
    }
    throw new Error("Invalid backend response");
  } catch (err) {
    if (shouldFallbackToLocal(err)) {
      const now = new Date().toISOString();
      const newGoal: HealthGoal = {
        _id: generateLocalId(),
        userId,
        familyMemberId:
          payload.familyMemberId && payload.familyMemberId !== "self"
            ? payload.familyMemberId
            : null,
        title: payload.title.trim(),
        goalType: payload.goalType,
        target: Math.max(1, Math.round(payload.target)),
        current: 0,
        startDate: payload.startDate || now.slice(0, 10),
        endDate: payload.endDate || null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };

      const goals = await loadLocalGoals(userId);
      goals.unshift(newGoal);
      await saveLocalGoals(userId, goals);

      return {
        success: true,
        message: "Goal created successfully",
        goal: newGoal,
      };
    }
    throw err;
  }
}

export async function updateHealthGoal(
  userId: string,
  goalId: string,
  payload: UpdateHealthGoalPayload,
): Promise<{ success: boolean; message?: string; goal: HealthGoal }> {
  try {
    const response = await api.patch<{
      success: boolean;
      message?: string;
      goal: HealthGoal;
    }>(`/appointment/patient/health-goals/${goalId}`, payload, {
      auth: true,
      timeout: 10000,
    });
    if (response?.goal) {
      const goals = await loadLocalGoals(userId);
      const index = goals.findIndex((g) => g._id === goalId);
      if (index !== -1) {
        goals[index] = response.goal;
        await saveLocalGoals(userId, goals);
      }
      return response;
    }
    throw new Error("Invalid backend response");
  } catch (err) {
    if (shouldFallbackToLocal(err)) {
      const goals = await loadLocalGoals(userId);
      const index = goals.findIndex((g) => g._id === goalId);

      if (index === -1) {
        throw new Error(`Goal with ID ${goalId} not found.`);
      }

      const updatedGoal: HealthGoal = {
        ...goals[index],
        ...(payload.title !== undefined ? { title: payload.title.trim() } : {}),
        ...(payload.target !== undefined
          ? { target: Math.max(1, Math.round(payload.target)) }
          : {}),
        ...(payload.endDate !== undefined ? { endDate: payload.endDate } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.status === "completed" && !goals[index].completedAt
          ? { completedAt: new Date().toISOString() }
          : {}),
        updatedAt: new Date().toISOString(),
      };

      goals[index] = updatedGoal;
      await saveLocalGoals(userId, goals);

      return {
        success: true,
        message: "Goal updated successfully",
        goal: updatedGoal,
      };
    }
    throw err;
  }
}

export async function deleteHealthGoal(
  userId: string,
  goalId: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await api.delete<{ success: boolean; message?: string }>(
      `/appointment/patient/health-goals/${goalId}`,
      { auth: true, timeout: 10000 },
    );
    // Sync local
    const goals = await loadLocalGoals(userId);
    const filtered = goals.filter((g) => g._id !== goalId);
    await saveLocalGoals(userId, filtered);
    return response;
  } catch (err) {
    if (shouldFallbackToLocal(err)) {
      const goals = await loadLocalGoals(userId);
      const filtered = goals.filter((g) => g._id !== goalId);
      await saveLocalGoals(userId, filtered);

      return {
        success: true,
        message: "Goal deleted successfully",
      };
    }
    throw err;
  }
}

/**
 * Updates local goal progress and automatically marks completion if target reached.
 */
export async function syncGoalCalculatedProgress(
  userId: string,
  goalId: string,
  calculatedCurrent: number,
  target: number,
): Promise<HealthGoal | null> {
  try {
    const goals = await loadLocalGoals(userId);
    const index = goals.findIndex((g) => g._id === goalId);
    if (index === -1) return null;

    const goal = goals[index];
    const isCompleted = calculatedCurrent >= target && target > 0;
    const now = new Date().toISOString();

    const updated: HealthGoal = {
      ...goal,
      current: calculatedCurrent,
      target,
      status:
        isCompleted && goal.status === "active" ? "completed" : goal.status,
      completedAt: isCompleted && !goal.completedAt ? now : goal.completedAt,
      updatedAt: now,
    };

    goals[index] = updated;
    await saveLocalGoals(userId, goals);
    return updated;
  } catch {
    return null;
  }
}
