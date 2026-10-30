import React, { useCallback, useEffect, useState } from "react";
import Layout from "../components/Layout/Layout";
import toast from "../utils/notify";
import API from "../Api/API";
import ConfirmDialog from "../components/common/ConfirmDialog";
import {
  FaUpload,
  FaVideo,
  FaExternalLinkAlt,
  FaSave,
  FaPlay,
  FaInfoCircle,
  FaTrash,
  FaTimes,
  FaClock,
  FaTag,
} from "react-icons/fa";

const VIDEO_CATEGORIES = [
  "Patient Onboarding",
  "Doctor Consultation Guide",
  "Appointment Booking Tour",
  "Hospital Facilities & Services",
  "Billing & Insurance Help",
  "Emergency Protocols",
];

const VideoManagement = () => {
  const [loading, setLoading] = useState(true);
  const [savingDetails, setSavingDetails] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  const [form, setForm] = useState({
    guideVideoUrl: "",
    guideVideoTitle: "HealPoint Platform Walkthrough & Patient Guide",
    guideVideoDescription:
      "A complete walkthrough explaining how patients can search for doctors, book appointments, make digital payments, and access laboratory records.",
    guideVideoCategory: "Patient Onboarding",
    guideVideoDuration: "3m 45s",
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/settings");
      const settings = res.data?.settings || {};
      setForm({
        guideVideoUrl: settings.guideVideoUrl || "",
        guideVideoTitle:
          settings.guideVideoTitle ||
          "HealPoint Platform Walkthrough & Patient Guide",
        guideVideoDescription:
          settings.guideVideoDescription ||
          "A complete walkthrough explaining how patients can search for doctors, book appointments, make digital payments, and access laboratory records.",
        guideVideoCategory: settings.guideVideoCategory || "Patient Onboarding",
        guideVideoDuration: settings.guideVideoDuration || "3m 45s",
      });
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          "Unable to load guide video settings.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePickVideo = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      return toast.error("Video file must be under 100MB");
    }
    setSelectedVideo(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const clearSelectedVideo = () => {
    if (videoPreview && videoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(videoPreview);
    }
    setSelectedVideo(null);
    setVideoPreview("");
  };

  useEffect(() => {
    return () => {
      if (videoPreview && videoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(videoPreview);
      }
    };
  }, [videoPreview]);

  const handleSaveDetails = async (event) => {
    event.preventDefault();
    setSavingDetails(true);
    try {
      await API.patch("/settings", {
        guideVideoUrl: form.guideVideoUrl.trim(),
        guideVideoTitle: form.guideVideoTitle.trim(),
        guideVideoDescription: form.guideVideoDescription.trim(),
        guideVideoCategory: form.guideVideoCategory,
        guideVideoDuration: form.guideVideoDuration.trim(),
      });
      toast.success("Guide video configuration saved successfully.");
      load();
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Unable to save video details.",
      );
    } finally {
      setSavingDetails(false);
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!selectedVideo) return toast.error("Please select a video file.");

    const formData = new FormData();
    formData.append("video", selectedVideo);

    setUploading(true);
    try {
      const res = await API.patch("/settings/video", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(
        "Guide video uploaded successfully. It is now live across the platform.",
      );
      clearSelectedVideo();
      if (res.data?.guideVideoUrl) {
        setForm((prev) => ({ ...prev, guideVideoUrl: res.data.guideVideoUrl }));
      }
      load();
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Unable to upload the video.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveVideo = async () => {
    setConfirmRemoveOpen(false);
    setSavingDetails(true);
    try {
      await API.patch("/settings", {
        guideVideoUrl: "",
      });
      toast.success("Guide video removed successfully.");
      setForm((prev) => ({ ...prev, guideVideoUrl: "" }));
      load();
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Unable to remove the guide video.",
      );
    } finally {
      setSavingDetails(false);
    }
  };

  const currentActiveSrc = videoPreview || form.guideVideoUrl;

  return (
    <Layout>
      <section className="page-intro">
        <div>
          <span className="eyebrow">Platform Content</span>
          <h2>Video Guide & Tutorial Management</h2>
          <p>
            Configure the user-facing instructional video displayed across
            mobile apps and patient web portal.
          </p>
        </div>
      </section>

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
          <p>Loading video guide configuration...</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "24px",
            maxWidth: "1080px",
            margin: "0 auto",
          }}
        >
          {/* Card 1: Video Player & Live Preview */}
          <div
            className="panel-card"
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 24px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.8rem",
                    fontWeight: "600",
                    color: "#0d9488",
                    background: "#ccfbf1",
                    padding: "3px 10px",
                    borderRadius: "12px",
                    marginBottom: "6px",
                  }}
                >
                  <FaTag /> {form.guideVideoCategory}
                </span>
                <h3
                  style={{ margin: 0, fontSize: "1.25rem", color: "#0f172a" }}
                >
                  {form.guideVideoTitle || "Platform Video Guide"}
                </h3>
              </div>

              <div
                style={{ display: "flex", gap: "10px", alignItems: "center" }}
              >
                {form.guideVideoDuration && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "0.85rem",
                      color: "#64748b",
                      background: "#f1f5f9",
                      padding: "4px 10px",
                      borderRadius: "6px",
                    }}
                  >
                    <FaClock /> {form.guideVideoDuration}
                  </span>
                )}
                {form.guideVideoUrl && (
                  <>
                    <a
                      className="btn btn-light btn-sm"
                      href={form.guideVideoUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <FaExternalLinkAlt /> Open Direct
                    </a>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setConfirmRemoveOpen(true)}
                      disabled={savingDetails}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <FaTrash /> Remove Video
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Video Player Display */}
            <div
              style={{
                background: "#090d16",
                minHeight: "360px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              {currentActiveSrc ? (
                <video
                  key={currentActiveSrc}
                  src={currentActiveSrc}
                  controls
                  style={{
                    width: "100%",
                    maxHeight: "480px",
                    background: "#000",
                  }}
                  preload="metadata"
                />
              ) : (
                <div
                  style={{
                    padding: "48px 24px",
                    textAlign: "center",
                    color: "#94a3b8",
                  }}
                >
                  <FaVideo
                    style={{
                      fontSize: "3rem",
                      marginBottom: "12px",
                      color: "#475569",
                    }}
                  />
                  <h4 style={{ color: "#cbd5e1", marginBottom: "8px" }}>
                    No Guide Video Configured
                  </h4>
                  <p
                    style={{
                      maxWidth: "420px",
                      margin: "0 auto",
                      fontSize: "0.9rem",
                    }}
                  >
                    The video player is currently hidden on patient apps. Upload
                    a video file or enter a hosted URL below to activate the
                    patient tutorial.
                  </p>
                </div>
              )}
            </div>

            {/* Video description summary */}
            <div
              style={{
                padding: "16px 24px",
                background: "#f8fafc",
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#475569",
                  fontSize: "0.92rem",
                  lineHeight: "1.5",
                }}
              >
                {form.guideVideoDescription || "No guide description provided."}
              </p>
            </div>
          </div>

          {/* Dual Column: Settings Form & Upload Panel */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
              gap: "24px",
            }}
          >
            {/* Column 1: Video Metadata & Hosted URL Form */}
            <div
              className="panel-card"
              style={{
                background: "#ffffff",
                borderRadius: "16px",
                border: "1px solid #e2e8f0",
                padding: "24px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              }}
            >
              <h4
                style={{
                  margin: "0 0 4px",
                  fontSize: "1.1rem",
                  color: "#0f172a",
                }}
              >
                Guide Video Information
              </h4>
              <p
                style={{
                  color: "#64748b",
                  fontSize: "0.85rem",
                  marginBottom: "20px",
                }}
              >
                Customize the title, duration, category, and direct stream URL.
              </p>

              <form onSubmit={handleSaveDetails}>
                <div style={{ marginBottom: "16px" }}>
                  <label
                    className="label"
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontWeight: "600",
                      fontSize: "0.85rem",
                    }}
                  >
                    Guide Video Title
                  </label>
                  <input
                    type="text"
                    className="table-filter-input"
                    value={form.guideVideoTitle}
                    onChange={(e) =>
                      setForm({ ...form, guideVideoTitle: e.target.value })
                    }
                    placeholder="e.g. How to Book an Appointment"
                    style={{ width: "100%" }}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <label
                      className="label"
                      style={{
                        display: "block",
                        marginBottom: "6px",
                        fontWeight: "600",
                        fontSize: "0.85rem",
                      }}
                    >
                      Category
                    </label>
                    <select
                      className="table-filter-select"
                      value={form.guideVideoCategory}
                      onChange={(e) =>
                        setForm({ ...form, guideVideoCategory: e.target.value })
                      }
                      style={{ width: "100%" }}
                    >
                      {VIDEO_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      className="label"
                      style={{
                        display: "block",
                        marginBottom: "6px",
                        fontWeight: "600",
                        fontSize: "0.85rem",
                      }}
                    >
                      Estimated Duration
                    </label>
                    <input
                      type="text"
                      className="table-filter-input"
                      value={form.guideVideoDuration}
                      onChange={(e) =>
                        setForm({ ...form, guideVideoDuration: e.target.value })
                      }
                      placeholder="e.g. 3m 45s"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label
                    className="label"
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontWeight: "600",
                      fontSize: "0.85rem",
                    }}
                  >
                    Description
                  </label>
                  <textarea
                    className="table-filter-input"
                    rows={3}
                    value={form.guideVideoDescription}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        guideVideoDescription: e.target.value,
                      })
                    }
                    placeholder="Summary of what is covered in this guide..."
                    style={{ width: "100%", resize: "vertical" }}
                  />
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label
                    className="label"
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontWeight: "600",
                      fontSize: "0.85rem",
                    }}
                  >
                    Direct Video Stream URL (HTTP/HTTPS)
                  </label>
                  <input
                    type="url"
                    className="table-filter-input"
                    value={form.guideVideoUrl}
                    onChange={(e) =>
                      setForm({ ...form, guideVideoUrl: e.target.value })
                    }
                    placeholder="https://commondatastorage.googleapis.com/.../guide.mp4"
                    style={{ width: "100%" }}
                  />
                  <small
                    style={{
                      color: "#64748b",
                      fontSize: "0.78rem",
                      display: "block",
                      marginTop: "4px",
                    }}
                  >
                    Must be a direct link to an MP4, WebM, or HLS stream.
                  </small>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingDetails}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                    justifyContent: "center",
                  }}
                >
                  <FaSave />{" "}
                  {savingDetails
                    ? "Saving Changes..."
                    : "Save Guide Video Details"}
                </button>
              </form>
            </div>

            {/* Column 2: Upload Video File */}
            <div
              className="panel-card"
              style={{
                background: "#ffffff",
                borderRadius: "16px",
                border: "1px solid #e2e8f0",
                padding: "24px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <h4
                style={{
                  margin: "0 0 4px",
                  fontSize: "1.1rem",
                  color: "#0f172a",
                }}
              >
                Upload Local Video File
              </h4>
              <p
                style={{
                  color: "#64748b",
                  fontSize: "0.85rem",
                  marginBottom: "20px",
                }}
              >
                Upload an MP4 or WebM video file directly to the HealPoint
                server storage.
              </p>

              {selectedVideo && videoPreview ? (
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "10px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.88rem",
                        fontWeight: "600",
                        color: "#0f172a",
                      }}
                    >
                      Selected: {selectedVideo.name}
                    </div>
                    <button
                      type="button"
                      className="btn btn-light btn-sm"
                      onClick={clearSelectedVideo}
                      style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                    >
                      <FaTimes /> Clear
                    </button>
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "#64748b",
                      marginBottom: "12px",
                    }}
                  >
                    Size:{" "}
                    <strong>
                      {(selectedVideo.size / (1024 * 1024)).toFixed(2)} MB
                    </strong>{" "}
                    | Type: {selectedVideo.type || "video/mp4"}
                  </div>
                  <video
                    src={videoPreview}
                    controls
                    style={{
                      width: "100%",
                      maxHeight: "160px",
                      borderRadius: "8px",
                      background: "#000",
                    }}
                  />
                </div>
              ) : null}

              <label
                className="gallery-file-upload"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  padding: "36px 20px",
                  border: "2px dashed #cbd5e1",
                  borderRadius: "12px",
                  cursor: "pointer",
                  background: "#f8fafc",
                  marginBottom: "20px",
                  flex: 1,
                  textAlign: "center",
                }}
              >
                <FaUpload style={{ fontSize: "2rem", color: "#0d9488" }} />
                <div>
                  <strong style={{ color: "#0f172a", display: "block" }}>
                    Click to select video file
                  </strong>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    Supports MP4, WebM, OGG (Max 100MB)
                  </span>
                </div>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/ogg"
                  onChange={handlePickVideo}
                  hidden
                />
              </label>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={uploading || !selectedVideo}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  justifyContent: "center",
                }}
              >
                <FaUpload />{" "}
                {uploading ? "Uploading Video..." : "Upload & Deploy Video"}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmRemoveOpen}
        title="Remove Platform Guide Video"
        message="Are you sure you want to remove the platform instructional video?"
        details="The video player will be cleared across patient and doctor applications until a new video is uploaded or configured."
        confirmLabel="Remove Video"
        onCancel={() => setConfirmRemoveOpen(false)}
        onConfirm={handleRemoveVideo}
        loading={savingDetails}
      />
    </Layout>
  );
};

export default VideoManagement;
