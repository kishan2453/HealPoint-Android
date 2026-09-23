/**
 * HealPoint - Hospital Admin · Smart Hospital Operations Center.
 *
 * Dedicated route (/admin/operations) for real-time OPD queue monitoring,
 * live appointment operations, doctor availability tracking, department workload,
 * and operational smart alerts.
 */
import React from "react";
import { StyleSheet, View } from "react-native";

import { AdminModuleScreen } from "@/components/admin/AdminModuleScreen";
import { OperationsCenter } from "@/components/admin/OperationsCenter";
import { Palette } from "@/constants/theme";

export default function AdminOperationsScreen() {
  return (
    <AdminModuleScreen
      title="Operations Center"
      subtitle="Real-time hospital OPD, queue & consultation monitoring"
      allowedRoles={["admin", "super_admin"]}
    >
      <View style={styles.container}>
        <OperationsCenter />
      </View>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
});
