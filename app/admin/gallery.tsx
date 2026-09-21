/**
 * HealPoint - Hospital Admin · Gallery Management Screen.
 * Real MongoDB gallery scoped to this hospital admin's hospitalId.
 * Multi-tenant isolation enforced server-side.
 * Features: 2-column grid, category filtering, fullscreen lightbox,
 * image upload with category picker, and delete confirmation.
 */
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AdminModuleScreen } from "@/components/admin/AdminModuleScreen";
import { FilterChips } from "@/components/admin/FilterChips";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { toErrorMessage } from "@/services/api";
import * as adminService from "@/services/admin";
import type { HospitalGalleryImage } from "@/services/admin";

const GALLERY_CATEGORIES = [
  { label: "All", value: "all" },
  { label: "Exterior", value: "exterior" },
  { label: "Interior", value: "interior" },
  { label: "OT & Surgery", value: "operation_theater" },
  { label: "ICU & Emergency", value: "icu" },
  { label: "Patient Rooms", value: "rooms" },
  { label: "Equipment & Tech", value: "equipment" },
  { label: "General", value: "general" },
];

export default function AdminGalleryScreen() {
  const [images, setImages] = useState<HospitalGalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Lightbox Modal
  const [lightboxImage, setLightboxImage] =
    useState<HospitalGalleryImage | null>(null);

  // Upload Modal State
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [pickedAsset, setPickedAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploadCategory, setUploadCategory] = useState("general");
  const [isUploading, setIsUploading] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<HospitalGalleryImage | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setError("");
      try {
        const res = await adminService.getHospitalGallery(
          categoryFilter !== "all" ? categoryFilter : undefined,
        );
        setImages(res.images || []);
      } catch (err) {
        setError(
          toErrorMessage(err, "Unable to load hospital gallery images."),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [categoryFilter],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Launch Expo Image Picker
  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPickedAsset(result.assets[0]);
      }
    } catch (err) {
      Alert.alert(
        "Permission needed",
        "Gallery access is required to pick an image.",
      );
    }
  };

  const handleUpload = async () => {
    if (!pickedAsset) return;
    setIsUploading(true);
    try {
      const base64Data = pickedAsset.base64
        ? "data:" +
          (pickedAsset.mimeType || "image/jpeg") +
          ";base64," +
          pickedAsset.base64
        : undefined;

      const uploadPayload = base64Data
        ? {
            images: [
              {
                base64: base64Data,
                category: uploadCategory,
                title: pickedAsset.fileName || uploadCategory + " photo",
              },
            ],
          }
        : {
            images: [
              {
                url: pickedAsset.uri,
                category: uploadCategory,
                title: pickedAsset.fileName || uploadCategory + " photo",
              },
            ],
          };

      const res = await adminService.uploadHospitalGallery(uploadPayload);
      if (res.images && res.images.length > 0) {
        setImages((prev) => [...res.images, ...prev]);
      } else {
        await load();
      }
      setUploadModalVisible(false);
      setPickedAsset(null);
    } catch (err) {
      Alert.alert(
        "Upload Failed",
        toErrorMessage(err, "Could not upload the selected image."),
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await adminService.deleteHospitalGalleryImage(deleteTarget._id);
      setImages((prev) => prev.filter((img) => img._id !== deleteTarget._id));
      if (lightboxImage?._id === deleteTarget._id) {
        setLightboxImage(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      Alert.alert(
        "Delete Failed",
        toErrorMessage(err, "Could not delete the image."),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredImages = useMemo(() => {
    if (categoryFilter === "all") return images;
    return images.filter(
      (img) =>
        String(img.category || "").toLowerCase() ===
        categoryFilter.toLowerCase(),
    );
  }, [images, categoryFilter]);

  return (
    <AdminModuleScreen
      title="Hospital Gallery"
      subtitle={
        images.length +
        " photo" +
        (images.length === 1 ? "" : "s") +
        " showcased"
      }
      allowedRoles={["admin"]}
      loading={loading}
      error={error}
      onRetry={() => load()}
    >
      <FlatList
        data={filteredImages}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            {/* Top Row with Upload Button */}
            <View style={styles.headerTopRow}>
              <View>
                <Text style={styles.sectionHeading}>Premises & Facilities</Text>
                <Text style={styles.sectionSubtitle}>
                  Photos displayed on your public hospital profile
                </Text>
              </View>
              <Button
                title="+ Add Photo"
                variant="primary"
                fullWidth={false}
                style={styles.uploadTriggerBtn}
                onPress={() => {
                  setPickedAsset(null);
                  setUploadModalVisible(true);
                }}
              />
            </View>

            {/* Category Filter Chips */}
            <FilterChips
              options={GALLERY_CATEGORIES}
              selected={categoryFilter}
              onSelect={setCategoryFilter}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No gallery images"
            message={
              categoryFilter !== "all"
                ? 'No images found in this category. Tap "+ Add Photo" to upload one.'
                : "Upload premises photos, operation theaters, and ward images to build trust with patients."
            }
          />
        }
        renderItem={({ item }) => {
          const displayTitle =
            item.title || item.name || item.category || "Hospital Facility";
          return (
            <Pressable
              style={styles.imageCardPressable}
              onPress={() => setLightboxImage(item)}
              accessibilityLabel={"View " + displayTitle}
            >
              <Card style={styles.imageCard}>
                <Image
                  source={{ uri: item.url }}
                  style={styles.image}
                  resizeMode="cover"
                />

                {/* Overlay category badge + delete button */}
                <View style={styles.cardOverlay}>
                  <View style={styles.categoryBadgeWrapper}>
                    <Badge
                      label={String(item.category || "general").replace(
                        /_/g,
                        " ",
                      )}
                      variant="neutral"
                    />
                  </View>
                  <Pressable
                    style={styles.deleteOverlayBtn}
                    onPress={() => setDeleteTarget(item)}
                    accessibilityLabel="Delete image"
                  >
                    <Ionicons name="trash" size={14} color="#FFF" />
                  </Pressable>
                </View>

                {/* Bottom title info */}
                <View style={styles.imageMetaBottom}>
                  <Text style={styles.imageNameText} numberOfLines={1}>
                    {displayTitle}
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />

      {/* FULLSCREEN LIGHTBOX MODAL */}
      {lightboxImage && (
        <Modal
          visible={Boolean(lightboxImage)}
          transparent
          animationType="fade"
          onRequestClose={() => setLightboxImage(null)}
        >
          <View style={styles.lightboxBackdrop}>
            <View style={styles.lightboxContainer}>
              {/* Top Bar */}
              <View style={styles.lightboxHeader}>
                <View style={styles.lightboxTitleGroup}>
                  <Text style={styles.lightboxTitle} numberOfLines={1}>
                    {lightboxImage.title ||
                      lightboxImage.name ||
                      "Hospital Photo"}
                  </Text>
                  <Text style={styles.lightboxSub}>
                    {String(lightboxImage.category || "General")
                      .replace(/_/g, " ")
                      .toUpperCase()}
                  </Text>
                </View>
                <Pressable
                  style={styles.closeBtn}
                  onPress={() => setLightboxImage(null)}
                  accessibilityLabel="Close lightbox"
                >
                  <Ionicons name="close" size={24} color="#FFF" />
                </Pressable>
              </View>

              {/* Image Preview */}
              <Image
                source={{ uri: lightboxImage.url }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />

              {/* Bottom Actions */}
              <View style={styles.lightboxFooter}>
                <View style={styles.lightboxDimensions}>
                  <Ionicons
                    name="image-outline"
                    size={16}
                    color="rgba(255,255,255,0.7)"
                  />
                  <Text style={styles.dimensionsText}>
                    {lightboxImage.width && lightboxImage.height
                      ? lightboxImage.width +
                        " × " +
                        lightboxImage.height +
                        "px"
                      : "Hospital Image"}
                  </Text>
                </View>
                <Button
                  title="Delete Photo"
                  variant="danger"
                  fullWidth={false}
                  style={styles.lightboxDeleteBtn}
                  onPress={() => {
                    setDeleteTarget(lightboxImage);
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* UPLOAD MODAL */}
      <Modal
        visible={uploadModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setUploadModalVisible(false)}
      >
        <View style={styles.uploadModalBackdrop}>
          <View style={styles.uploadModalCard}>
            <View style={styles.uploadModalHeader}>
              <Text style={styles.uploadModalTitle}>Upload Photo</Text>
              <Pressable
                onPress={() => setUploadModalVisible(false)}
                accessibilityLabel="Close upload dialog"
              >
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            {/* Image Picker Dropzone */}
            {!pickedAsset ? (
              <Pressable
                style={styles.pickImageDropzone}
                onPress={handlePickImage}
              >
                <Ionicons
                  name="cloud-upload-outline"
                  size={36}
                  color={Palette.primary}
                />
                <Text style={styles.pickImagePrompt}>
                  Select photo from device library
                </Text>
                <Text style={styles.pickImageHint}>
                  PNG, JPG, or WEBP up to 5MB
                </Text>
              </Pressable>
            ) : (
              <View style={styles.previewContainer}>
                <Image
                  source={{ uri: pickedAsset.uri }}
                  style={styles.previewImage}
                />
                <Pressable
                  style={styles.changeImageBtn}
                  onPress={handlePickImage}
                >
                  <Ionicons name="camera-reverse" size={16} color="#FFF" />
                  <Text style={styles.changeImageText}>Change</Text>
                </Pressable>
              </View>
            )}

            {/* Category Selector */}
            <Text style={styles.categoryLabel}>Select Category</Text>
            <View style={styles.uploadCategoryRow}>
              {GALLERY_CATEGORIES.filter((c) => c.value !== "all").map(
                (cat) => {
                  const isSelected = uploadCategory === cat.value;
                  return (
                    <Pressable
                      key={cat.value}
                      style={[
                        styles.uploadCategoryChip,
                        isSelected && styles.uploadCategoryChipSelected,
                      ]}
                      onPress={() => setUploadCategory(cat.value)}
                    >
                      <Text
                        style={[
                          styles.uploadCategoryChipText,
                          isSelected && styles.uploadCategoryChipTextSelected,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>

            {/* Actions */}
            <View style={styles.uploadActionsRow}>
              <Button
                title="Cancel"
                variant="outline"
                fullWidth
                style={styles.uploadActionBtn}
                onPress={() => setUploadModalVisible(false)}
              />
              <Button
                title="Upload to Gallery"
                variant="primary"
                fullWidth
                disabled={!pickedAsset}
                loading={isUploading}
                style={styles.uploadActionBtn}
                onPress={handleUpload}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        visible={Boolean(deleteTarget)}
        title="Delete Image"
        message="Are you sure you want to remove this photo from your hospital gallery? This action is permanent."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        loading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  headerContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  sectionHeading: {
    ...Typography.h4,
    color: Palette.text,
    fontWeight: "700",
  },
  sectionSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  uploadTriggerBtn: {
    minHeight: 36,
    paddingHorizontal: Spacing.md,
  },
  columns: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  imageCardPressable: {
    flex: 1,
  },
  imageCard: {
    flex: 1,
    padding: 0,
    overflow: "hidden",
    borderRadius: Radius.lg,
  },
  image: {
    width: "100%",
    height: 130,
    backgroundColor: Palette.border,
  },
  cardOverlay: {
    position: "absolute",
    top: Spacing.xs,
    left: Spacing.xs,
    right: Spacing.xs,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryBadgeWrapper: {
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  deleteOverlayBtn: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(217, 67, 91, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageMetaBottom: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Palette.surface,
  },
  imageNameText: {
    ...Typography.caption,
    color: Palette.text,
    fontWeight: "600",
  },

  // Lightbox Modal
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    justifyContent: "space-between",
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  lightboxContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  lightboxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: Spacing.sm,
  },
  lightboxTitleGroup: {
    flex: 1,
    gap: 2,
  },
  lightboxTitle: {
    ...Typography.h3,
    color: "#FFF",
  },
  lightboxSub: {
    ...Typography.caption,
    color: "rgba(255, 255, 255, 0.7)",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxImage: {
    flex: 1,
    width: "100%",
    maxHeight: 450,
  },
  lightboxFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255, 255, 255, 0.15)",
  },
  lightboxDimensions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dimensionsText: {
    ...Typography.caption,
    color: "rgba(255, 255, 255, 0.7)",
  },
  lightboxDeleteBtn: {
    borderColor: "rgba(217, 67, 91, 0.5)",
    minHeight: 36,
  },

  // Upload Modal
  uploadModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  uploadModalCard: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    maxHeight: "90%",
  },
  uploadModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  uploadModalTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  pickImageDropzone: {
    height: 140,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Palette.primary,
    borderStyle: "dashed",
    backgroundColor: Palette.primary + "08",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pickImagePrompt: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.primary,
  },
  pickImageHint: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  previewContainer: {
    height: 160,
    borderRadius: Radius.lg,
    overflow: "hidden",
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  changeImageBtn: {
    position: "absolute",
    bottom: Spacing.xs,
    right: Spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  changeImageText: {
    ...Typography.caption,
    color: "#FFF",
    fontWeight: "600",
  },
  categoryLabel: {
    ...Typography.label,
    color: Palette.text,
  },
  uploadCategoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  uploadCategoryChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  uploadCategoryChipSelected: {
    borderColor: Palette.primary,
    backgroundColor: Palette.primary + "18",
  },
  uploadCategoryChipText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  uploadCategoryChipTextSelected: {
    color: Palette.primary,
    fontWeight: "700",
  },
  uploadActionsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  uploadActionBtn: {
    flex: 1,
    minHeight: 44,
  },
});
