import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function HospitalAdminStaffScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hospital Staff Management</Text>
      <Text style={styles.subtitle}>Manage medical and administrative hospital staff members.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
  },
});
