/**
 * HealPoint - Admin · Security & Password.
 */
import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { AdminModuleScreen } from "@/components/admin/AdminModuleScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { Palette, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { toErrorMessage } from "@/services/api";
import * as authService from "@/services/auth";

export default function AdminSecurityScreen() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleUpdate = async () => {
    setError("");
    setSuccess("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }
    setLoading(true);
    try {
      await authService.updatePassword(String(user?._id), {
        oldPassword: currentPassword,
        newPassword,
      });
      setSuccess("Your password has been changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(toErrorMessage(err, "Failed to update password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminModuleScreen
      title="Security"
      subtitle="Manage your account password"
      allowedRoles={["admin", "super_admin"]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card padded style={styles.card}>
          {error ? <FormMessage type="error" message={error} /> : null}
          {success ? <FormMessage type="success" message={success} /> : null}

          <Input
            label="Current Password"
            placeholder="Enter current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
          />
          <Input
            label="New Password"
            placeholder="Must be at least 8 characters"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
          <Input
            label="Confirm New Password"
            placeholder="Re-type new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
          <View style={styles.actions}>
            <Button
              title="Change Password"
              onPress={handleUpdate}
              loading={loading}
            />
          </View>
        </Card>
      </ScrollView>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
  card: { gap: Spacing.md },
  actions: { marginTop: Spacing.sm },
});
