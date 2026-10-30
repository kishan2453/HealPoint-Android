import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout/Layout";
import toast from "../utils/notify";
import API from "../Api/API";
import ConfirmDialog from "../components/common/ConfirmDialog";
import {
  FaImages,
  FaPlus,
  FaTimes,
  FaTrash,
  FaUpload,
  FaSearch,
  FaExpand,
  FaCalendarAlt,
  FaTag,
  FaHdd,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";

const CATEGORIES = [
  "Hospital Photos",
  "Reception Area",
  "Consultation Rooms",
  "Facilities",
  "Doctor Team",
];

const FALLBACK_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300' fill='%23f1f5f9'><rect width='400' height='300' fill='%23e2e8f0'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='16' fill='%2364748b'>Image Unavailable</text></svg>";

const formatBytes = (bytes = 0) => {
  if (!Number(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(+bytes) / Math.log(1024));
  return `${(+bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "N/A";
  }
};

const GalleryManagement = () => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState(CATEGORIES[0]);
  const [uploadName, setUploadName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [imgDimensions, setImgDimensions] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/gallery");
      setImages(res.data?.images || []);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Unable to load gallery images.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Close lightbox on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setLightboxImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handlePickFiles = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const newFiles = [...selectedFiles, ...files];
    setSelectedFiles(newFiles);
    setPreviews(newFiles.map((file) => URL.createObjectURL(file)));
  };

  const removePickedFile = (indexToRemove) => {
    if (previews[indexToRemove]) {
      URL.revokeObjectURL(previews[indexToRemove]);
    }
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setPreviews((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const clearPicker = () => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setPreviews([]);
    setSelectedFiles([]);
    setUploadName("");
  };

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!selectedFiles.length)
      return toast.error("Please select at least one image.");

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("images", file));
    formData.append("category", uploadCategory);
    if (uploadName.trim()) formData.append("names", uploadName.trim());

    setUploading(true);
    try {
      await API.post("/gallery", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Gallery images uploaded successfully.");
      setUploadOpen(false);
      clearPicker();
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to upload images.");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await API.delete(`/gallery/${deleteTarget._id}`);
      toast.success("Gallery image deleted successfully.");
      setDeleteTarget(null);
      if (lightboxImage?._id === deleteTarget._id) {
        setLightboxImage(null);
      }
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to delete image.");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    return images.filter((item) => {
      const matchesCategory = category === "all" || item.category === category;
      const matchesSearch =
        !search.trim() ||
        (item.name &&
          item.name.toLowerCase().includes(search.trim().toLowerCase())) ||
        (item.category &&
          item.category.toLowerCase().includes(search.trim().toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [images, category, search]);

  const categoryCounts = useMemo(() => {
    const counts = { all: images.length };
    CATEGORIES.forEach((cat) => {
      counts[cat] = images.filter((img) => img.category === cat).length;
    });
    return counts;
  }, [images]);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 12;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, category]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginatedImages = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);


  return (
    <Layout>
      <section className="page-intro">
        <div>
          <span className="eyebrow">Platform Content</span>
          <h2>Gallery Management</h2>
          <p>
            Manage hospital and clinic visual assets displayed across patient
            and doctor applications.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setUploadOpen(true)}
        >
          <FaPlus /> Upload Images
        </button>
      </section>

      {/* Toolbar: Search + Category Filters */}
      <div className="table-toolbar">
        <div
          className="search-filter-row"
          style={{ flexWrap: "wrap", gap: "12px" }}
        >
          <div
            className="search-input-wrapper"
            style={{ position: "relative", minWidth: "260px" }}
          >
            <input
              type="text"
              className="table-filter-input"
              placeholder="Search images by name or tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "36px" }}
            />
            <FaSearch
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
                pointerEvents: "none",
              }}
            />
          </div>

          <select
            className="table-filter-select"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">
              All Categories ({categoryCounts.all || 0})
            </option>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item} ({categoryCounts[item] || 0})
              </option>
            ))}
          </select>

          <span className="table-count" style={{ marginLeft: "auto" }}>
            Showing <strong>{filtered.length}</strong> of {images.length} images
          </span>
        </div>
      </div>

      {loading ? (
        <div
          className="loading-state"
          style={{ padding: "48px 0", textAlign: "center" }}
        >
          <div
            className="spinner-border text-primary"
            role="status"
            style={{ marginBottom: "12px" }}
          />
          <p>Loading gallery images...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="empty-state"
          style={{
            padding: "48px 24px",
            textAlign: "center",
            background: "#f8fafc",
            borderRadius: "12px",
            border: "1px dashed #cbd5e1",
            margin: "20px 0",
          }}
        >
          <FaImages
            style={{
              fontSize: "2.5rem",
              color: "#94a3b8",
              marginBottom: "12px",
            }}
          />
          <h3>No gallery images found</h3>
          <p
            style={{
              color: "#64748b",
              maxWidth: "420px",
              margin: "0 auto 16px",
            }}
          >
            {search || category !== "all"
              ? "No images match the current search or category filter. Try clearing your search."
              : "No images have been uploaded yet. Upload your first hospital photos to showcase your facility."}
          </p>
          {search || category !== "all" ? (
            <button
              type="button"
              className="btn btn-light"
              onClick={() => {
                setSearch("");
                setCategory("all");
              }}
            >
              Clear Filters
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setUploadOpen(true)}
            >
              <FaUpload /> Upload Images Now
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="gallery-grid">
            {paginatedImages.map((item) => (
              <figure className="gallery-card" key={item._id}>
                <div
                  className="gallery-card-thumb-wrap"
                  onClick={() => {
                    setLightboxImage(item);
                    setImgDimensions(null);
                  }}
                >
                  <img
                    src={item.src}
                    alt={item.name || "Gallery image"}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.src = FALLBACK_IMAGE;
                    }}
                  />
                  <span className="gallery-badge">{item.category}</span>
                  <span className="gallery-preview-badge">
                    <FaExpand /> Preview
                  </span>
                </div>

                <figcaption className="gallery-card-body">
                  <div
                    className="gallery-card-title"
                    title={item.name || "Untitled Image"}
                  >
                    {item.name || "Untitled Image"}
                  </div>

                  <div className="gallery-card-meta">
                    <small style={{ color: "#64748b", fontSize: "0.78rem" }}>
                      {formatBytes(item.size)}
                    </small>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(item);
                      }}
                      style={{
                        padding: "4px 10px",
                        fontSize: "0.78rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <FaTrash /> Delete
                    </button>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>

          {totalPages > 1 && (
            <div
              className="pagination-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "24px",
                padding: "12px 16px",
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
                {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length} images
              </span>
              <div
                style={{ display: "flex", gap: "6px", alignItems: "center" }}
              >
                <button
                  type="button"
                  className="btn btn-light btn-sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <FaChevronLeft /> Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (num) => (
                    <button
                      type="button"
                      key={num}
                      className={`btn btn-sm ${num === currentPage ? "btn-primary" : "btn-light"}`}
                      onClick={() => setCurrentPage(num)}
                      style={{ minWidth: "32px", padding: "4px 8px" }}
                    >
                      {num}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="btn btn-light btn-sm"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  Next <FaChevronRight />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="app-confirm-backdrop"
          role="presentation"
          onClick={() => setLightboxImage(null)}
          style={{
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            background: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            className="app-confirm-dialog"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "840px",
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              padding: "24px",
              borderRadius: "16px",
              background: "#ffffff",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#0f172a" }}>
                  {lightboxImage.name || "Gallery Image"}
                </h3>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: "4px",
                    background: "#e0f2fe",
                    color: "#0369a1",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    fontWeight: "600",
                  }}
                >
                  {lightboxImage.category}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-light"
                onClick={() => setLightboxImage(null)}
                style={{
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  padding: 0,
                }}
                aria-label="Close"
              >
                <FaTimes />
              </button>
            </div>

            <div
              style={{
                borderRadius: "12px",
                overflow: "hidden",
                background: "#0f172a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                maxHeight: "520px",
                marginBottom: "16px",
              }}
            >
              <img
                src={lightboxImage.src}
                alt={lightboxImage.name}
                onLoad={(e) => {
                  setImgDimensions({
                    width: e.currentTarget.naturalWidth,
                    height: e.currentTarget.naturalHeight,
                  });
                }}
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_IMAGE;
                }}
                style={{
                  maxWidth: "100%",
                  maxHeight: "520px",
                  objectFit: "contain",
                }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "12px",
                background: "#f8fafc",
                padding: "12px 16px",
                borderRadius: "10px",
                marginBottom: "20px",
                fontSize: "0.85rem",
              }}
            >
              <div>
                <span
                  style={{
                    color: "#64748b",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <FaTag /> Category
                </span>
                <strong>{lightboxImage.category}</strong>
              </div>
              <div>
                <span
                  style={{
                    color: "#64748b",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <FaHdd /> File Size
                </span>
                <strong>{formatBytes(lightboxImage.size)}</strong>
              </div>
              {imgDimensions && (
                <div>
                  <span
                    style={{
                      color: "#64748b",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <FaExpand /> Dimensions
                  </span>
                  <strong>
                    {imgDimensions.width} × {imgDimensions.height} px
                  </strong>
                </div>
              )}
              <div>
                <span
                  style={{
                    color: "#64748b",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <FaCalendarAlt /> Uploaded
                </span>
                <strong>{formatDate(lightboxImage.createdAt)}</strong>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setDeleteTarget(lightboxImage);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaTrash /> Delete Image
              </button>
              <button
                type="button"
                className="btn btn-light"
                onClick={() => setLightboxImage(null)}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Dialog */}
      {uploadOpen && (
        <div className="app-confirm-backdrop" role="presentation">
          <div
            className="app-confirm-dialog gallery-upload-dialog"
            role="dialog"
            aria-modal="true"
            style={{ maxWidth: "560px", width: "100%", padding: "28px" }}
          >
            <button
              type="button"
              className="app-confirm-close"
              aria-label="Close"
              onClick={() => {
                setUploadOpen(false);
                clearPicker();
              }}
            >
              <FaTimes />
            </button>
            <div className="app-confirm-icon">
              <FaImages />
            </div>
            <h3>Upload Gallery Images</h3>
            <p>
              Select JPG, PNG, WEBP or GIF files to add to the platform gallery.
            </p>

            <label className="label">Category</label>
            <select
              className="table-filter-select"
              value={uploadCategory}
              onChange={(event) => setUploadCategory(event.target.value)}
              style={{ width: "100%", marginBottom: "14px" }}
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <label className="label">Image Name / Caption (optional)</label>
            <input
              className="table-filter-input"
              placeholder="e.g. Anand Hospital - New Cardiology Wing"
              value={uploadName}
              onChange={(event) => setUploadName(event.target.value)}
              style={{ width: "100%", marginBottom: "14px" }}
            />

            <label className="label">
              Selected Files{" "}
              {selectedFiles.length ? `(${selectedFiles.length})` : ""}
            </label>
            {previews.length ? (
              <div
                className="gallery-preview-row"
                style={{
                  display: "flex",
                  gap: "8px",
                  overflowX: "auto",
                  padding: "8px 0",
                  marginBottom: "12px",
                }}
              >
                {previews.map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    style={{
                      position: "relative",
                      width: "70px",
                      height: "70px",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={url}
                      alt="preview"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removePickedFile(index)}
                      style={{
                        position: "absolute",
                        top: "-6px",
                        right: "-6px",
                        background: "#ef4444",
                        color: "#fff",
                        border: "none",
                        borderRadius: "50%",
                        width: "20px",
                        height: "20px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10px",
                      }}
                      title="Remove"
                    >
                      <FaTimes />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <label
              className="gallery-file-upload"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "14px",
                border: "2px dashed #cbd5e1",
                borderRadius: "10px",
                cursor: "pointer",
                background: "#f8fafc",
                marginBottom: "20px",
              }}
            >
              <FaUpload /> Choose Images From Device
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={handlePickFiles}
                hidden
              />
            </label>

            <div className="app-confirm-actions">
              <button
                type="button"
                className="btn btn-light"
                onClick={() => {
                  setUploadOpen(false);
                  clearPicker();
                }}
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={uploading || !selectedFiles.length}
              >
                {uploading
                  ? "Uploading..."
                  : `Upload ${selectedFiles.length || ""} Image${
                      selectedFiles.length === 1 ? "" : "s"
                    }`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation with Thumbnail */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Gallery Image"
        message={`Are you sure you want to delete "${deleteTarget?.name || "this image"}" from the platform gallery?`}
        details={
          deleteTarget && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginTop: "12px",
              }}
            >
              <img
                src={deleteTarget.src}
                alt="thumb"
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "8px",
                  objectFit: "cover",
                }}
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_IMAGE;
                }}
              />
              <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                <div>
                  Category: <strong>{deleteTarget.category}</strong>
                </div>
                <div>
                  Size: <strong>{formatBytes(deleteTarget.size)}</strong>
                </div>
              </div>
            </div>
          )
        }
        confirmLabel="Delete Image"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeImage}
        loading={deleting}
      />
    </Layout>
  );
};

export default GalleryManagement;
