import React, { useEffect, useRef, useState, useCallback } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import { formatDoctorName } from "../services/doctorFormat";
import jsQR from "jsqr";
import "./CheckInScanner.css";
import {
  FaQrcode,
  FaCheckCircle,
  FaExclamationCircle,
  FaSyncAlt,
  FaCamera,
  FaKeyboard,
  FaPrint,
  FaUserCheck,
  FaUserClock,
  FaUserInjured,
  FaSearch,
  FaTimes,
  FaClock,
  FaUpload,
  FaInfoCircle,
  FaArrowRight,
} from "react-icons/fa";

export default function CheckInScannerView({ session }) {
  const [activeTab, setActiveTab] = useState("scan"); // "scan" | "queue"
  const [tokenInput, setTokenInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [lastError, setLastError] = useState("");
  const [alreadyCheckedInNotice, setAlreadyCheckedInNotice] = useState(null);

  // Camera scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Live Queue Dashboard state
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueData, setQueueData] = useState({
    summary: {
      totalToday: 0,
      checkedInCount: 0,
      waitingCount: 0,
      inConsultationCount: 0,
      completedCount: 0,
    },
    doctorStats: [],
    appointments: [],
  });
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Recent check-ins in this session (persisted in local state)
  const [recentCheckIns, setRecentCheckIns] = useState([]);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      } catch (e) {
        console.warn("Error stopping video stream tracks:", e);
      }
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // 1. Process Check-In API call
  const performCheckIn = async (codeToSubmit) => {
    const raw = (codeToSubmit !== undefined ? codeToSubmit : tokenInput).trim();
    if (!raw) {
      toast.warning("Please enter or scan an appointment QR or reference code");
      return;
    }

    setProcessing(true);
    setLastError("");
    setAlreadyCheckedInNotice(null);
    setLastResult(null);

    try {
      const res = await api.post("/api/v1/checkin/scan", { token: raw });
      if (res.data?.success) {
        if (res.data.alreadyCheckedIn) {
          toast.info(res.data.message || `Patient already checked in with Token: ${res.data.token}`);
          setAlreadyCheckedInNotice(res.data);
          setLastResult(res.data);
        } else {
          toast.success(`✓ Checked In! Queue Token: ${res.data.token}`);
          setLastResult(res.data);
          if (res.data.appointment) {
            setRecentCheckIns((prev) => {
              const existingIdx = prev.findIndex(
                (p) => String(p._id) === String(res.data.appointment._id)
              );
              if (existingIdx >= 0) return prev;
              return [res.data.appointment, ...prev.slice(0, 14)];
            });
          }
        }
        setTokenInput("");
        // Reload queue overview if queue tab or data exists
        loadQueueOverview();
      } else {
        const msg = res.data?.message || "Check-in verification failed";
        setLastError(msg);
        toast.error(msg);
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        "Check-in rejected. Please verify hospital and appointment status.";
      setLastError(msg);
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  // 2. Camera scanner implementation with jsQR + BarcodeDetector fallback
  const startCamera = async () => {
    setCameraError("");
    setCameraActive(true);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraActive(false);
      setCameraError(
        "Camera access is not supported on this browser or requires an HTTPS secure connection."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();

        // Canvas for jsQR decoding
        if (!canvasRef.current) {
          canvasRef.current = document.createElement("canvas");
        }
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        // Interval frame scanner
        scanIntervalRef.current = setInterval(async () => {
          const video = videoRef.current;
          if (video && video.readyState === 4 && video.videoWidth > 0) {
            // Priority 1: Native BarcodeDetector if available
            if ("BarcodeDetector" in window) {
              try {
                const barcodeDetector = new window.BarcodeDetector({
                  formats: ["qr_code"],
                });
                const barcodes = await barcodeDetector.detect(video);
                if (barcodes.length > 0 && barcodes[0].rawValue) {
                  const detectedVal = barcodes[0].rawValue;
                  stopCamera();
                  setTokenInput(detectedVal);
                  performCheckIn(detectedVal);
                  return;
                }
              } catch {
                // Fallback to jsQR below
              }
            }

            // Priority 2: Pure JS jsQR scanner (universal browser support)
            try {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
              });

              if (code && code.data) {
                stopCamera();
                setTokenInput(code.data);
                performCheckIn(code.data);
              }
            } catch {
              // Frame scan skip
            }
          }
        }, 250);
      }
    } catch (err) {
      setCameraActive(false);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError(
          "Camera permission was denied. Please allow camera permissions in your browser address bar and try again."
        );
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("No camera device was detected on your computer or workstation.");
      } else {
        setCameraError(
          "Unable to start video camera. Please use manual entry or upload a QR image below."
        );
      }
    }
  };

  // Decode QR code from uploaded image file
  const handleImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          toast.success("QR code extracted from image!");
          setTokenInput(code.data);
          performCheckIn(code.data);
        } else {
          toast.error("Could not find a valid QR code in the uploaded image.");
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // 3. Load Live Queue Dashboard
  const loadQueueOverview = useCallback(async () => {
    setQueueLoading(true);
    try {
      const res = await api.get("/api/v1/checkin/hospital/queue-overview", {
        params: {
          doctorId: doctorFilter !== "all" ? doctorFilter : undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
        },
      });
      if (res.data?.success) {
        setQueueData(res.data);
        // Prepopulate recent arrivals from checked-in appointments if none yet
        if (res.data.appointments && res.data.appointments.length > 0) {
          setRecentCheckIns((prev) => {
            if (prev.length > 0) return prev;
            return res.data.appointments.slice(0, 8);
          });
        }
      }
    } catch (err) {
      console.error("Failed to load live queue overview:", err);
    } finally {
      setQueueLoading(false);
    }
  }, [doctorFilter, statusFilter]);

  useEffect(() => {
    loadQueueOverview();
  }, [loadQueueOverview]);

  useEffect(() => {
    if (activeTab === "queue") {
      loadQueueOverview();
    }
  }, [activeTab, loadQueueOverview]);

  // Print Token Slip
  const handlePrintSlip = (apptToPrint) => {
    const apt = apptToPrint || lastResult?.appointment;
    const token = apptToPrint?.queueToken || lastResult?.token || "A-000";
    if (!apt) return;

    const printWindow = window.open("", "_blank", "width=420,height=560");
    if (!printWindow) {
      toast.warning("Please allow pop-ups to print queue token slips");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Token Slip - ${token}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; text-align: center; color: #0f172a; margin: 0; }
            .hosp { font-size: 18px; font-weight: 800; margin-bottom: 4px; color: #1e3a8a; }
            .sub { font-size: 12px; margin-bottom: 16px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
            .token-box { border: 2px dashed #2563eb; background: #eff6ff; border-radius: 12px; padding: 16px; margin: 18px 0; }
            .token-lbl { font-size: 11px; text-transform: uppercase; color: #1e40af; font-weight: 700; letter-spacing: 0.08em; }
            .token-num { font-size: 44px; font-weight: 900; letter-spacing: 2px; color: #1e3a8a; margin: 4px 0; }
            .token-note { font-size: 11px; color: #3b82f6; font-weight: 600; }
            .meta-table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; text-align: left; }
            .meta-table tr td { padding: 6px 4px; border-bottom: 1px solid #f1f5f9; }
            .meta-table tr td:first-child { color: #64748b; font-weight: 600; width: 40%; }
            .meta-table tr td:last-child { color: #0f172a; font-weight: 700; }
            .footer { font-size: 11px; margin-top: 22px; border-top: 1px solid #e2e8f0; padding-top: 12px; color: #64748b; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="hosp">${apt.hospitalName || "HealPoint Hospital"}</div>
          <div class="sub">OPD Reception Check-In Token</div>
          <div class="token-box">
            <div class="token-lbl">Queue Token</div>
            <div class="token-num">${token}</div>
            <div class="token-note">Please proceed to ${apt.doctorSpeciality || apt.department || "OPD"} Waiting Lounge</div>
          </div>
          <table class="meta-table">
            <tr><td>Patient Name:</td><td>${apt.patientName || "Verified Patient"}</td></tr>
            <tr><td>Phone Number:</td><td>${apt.patientPhone || "—"}</td></tr>
            <tr><td>Assigned Doctor:</td><td>${formatDoctorName(apt.doctorName)}</td></tr>
            <tr><td>Department:</td><td>${apt.doctorSpeciality || apt.department || "General OPD"}</td></tr>
            <tr><td>Appointment Ref:</td><td>${apt.appointmentId || apt.displayAppointmentId || "—"}</td></tr>
            <tr><td>Slot Time:</td><td>${apt.slotDate || ""} ${apt.slotTime ? `(${apt.slotTime})` : ""}</td></tr>
            <tr><td>Checked In At:</td><td>${new Date().toLocaleTimeString()}</td></tr>
          </table>
          <div class="footer">
            Thank you for choosing HealPoint Healthcare.<br/>
            Your token will be announced on the waiting room displays.
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filtered queue appointments
  const filteredAppointments = (queueData.appointments || []).filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.patientName && item.patientName.toLowerCase().includes(q)) ||
      (item.queueToken && item.queueToken.toLowerCase().includes(q)) ||
      (item.doctorName && item.doctorName.toLowerCase().includes(q)) ||
      (item.appointmentId && item.appointmentId.toLowerCase().includes(q))
    );
  });

  return (
    <div className="hp-checkin-wrapper">
      {/* 1. Page Header & Switcher */}
      <div className="hp-section-header">
        <div className="hp-header-left">
          <div className="hp-breadcrumb">
            <span>Hospital Operations</span>
            <span className="sep">/</span>
            <span className="current">Check-In & Queue</span>
          </div>
          <h2>Smart QR Check-In & Live Queue Center</h2>
          <p>
            Verify patient arrivals, scan secure appointment QR codes, issue
            tokens, and track today's live OPD flow.
          </p>
        </div>

        <div className="hp-tabs-switch">
          <button
            type="button"
            className={activeTab === "scan" ? "active" : ""}
            onClick={() => {
              setActiveTab("scan");
              stopCamera();
            }}
          >
            <FaQrcode /> Check-In Desk
          </button>
          <button
            type="button"
            className={activeTab === "queue" ? "active" : ""}
            onClick={() => {
              setActiveTab("queue");
              stopCamera();
            }}
          >
            <FaUserClock /> Live OPD Queue (
            {(queueData?.summary?.waitingCount || 0) +
              (queueData?.summary?.inConsultationCount || 0)}
            )
          </button>
        </div>
      </div>

      {activeTab === "scan" ? (
        <div className="hp-checkin-grid">
          {/* 2. Left Column: Scanner & Input Form Card */}
          <div className="hp-panel hp-scanner-card">
            <div className="hp-panel-head">
              <div>
                <h3>Reception Check-In Scanner</h3>
                <p>
                  Scan the patient's mobile QR code or enter their appointment reference number
                </p>
              </div>
            </div>

            {/* Video Scanner Area */}
            {cameraActive ? (
              <div className="hp-camera-container">
                <video ref={videoRef} className="hp-scanner-video" />
                <div className="hp-scanner-overlay">
                  <div className="hp-scanner-frame">
                    <span className="hp-corner top-left" />
                    <span className="hp-corner top-right" />
                    <span className="hp-corner bottom-left" />
                    <span className="hp-corner bottom-right" />
                    <div className="hp-laser-line" />
                  </div>
                  <div className="hp-scanner-hint">Align QR code inside the viewfinder</div>
                </div>
                <button
                  type="button"
                  className="hp-camera-close-btn"
                  onClick={stopCamera}
                  title="Close Camera"
                >
                  <FaTimes /> Stop Camera
                </button>
              </div>
            ) : (
              <div className="hp-camera-placeholder">
                <div className="hp-camera-icon-circle">
                  <FaQrcode className="hp-qr-large-icon" />
                </div>
                <h4>Start Video QR Scanner</h4>
                <p>
                  Point camera at the patient's mobile pass or printed appointment QR code
                </p>

                <div className="hp-camera-actions">
                  <button
                    type="button"
                    className="hp-btn hp-btn-primary"
                    onClick={startCamera}
                  >
                    <FaCamera /> Start Video Scanner
                  </button>

                  <button
                    type="button"
                    className="hp-btn hp-btn-outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FaUpload /> Upload QR Image
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleImageFile}
                  />
                </div>

                {cameraError ? (
                  <div className="hp-camera-err-box">
                    <FaExclamationCircle />
                    <span>{cameraError}</span>
                  </div>
                ) : null}
              </div>
            )}

            {/* 3. Barcode Gun / Manual Input Form */}
            <form
              className="hp-token-input-form"
              onSubmit={(e) => {
                e.preventDefault();
                performCheckIn();
              }}
            >
              <label htmlFor="tokenInput">
                <FaKeyboard /> Barcode Scanner Gun or Manual Reference:
              </label>
              <div className="hp-input-with-action">
                <input
                  id="tokenInput"
                  type="text"
                  placeholder="e.g. APT-2026-6B4843CB or short ref or scan gun"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  disabled={processing}
                  autoComplete="off"
                  autoFocus
                />
                <button
                  type="submit"
                  className="hp-btn hp-btn-primary"
                  disabled={processing || !tokenInput.trim()}
                >
                  {processing ? (
                    <>
                      <FaSyncAlt className="hp-spin" /> Verifying…
                    </>
                  ) : (
                    "Check-In Patient"
                  )}
                </button>
              </div>
              <small className="hp-input-tip">
                Tip: Plug in any standard USB/Bluetooth 2D barcode scanner gun. Click the field above and scan directly.
              </small>
            </form>

            {/* Error Feedback Display */}
            {lastError ? (
              <div className="hp-checkin-alert hp-alert-error">
                <FaExclamationCircle className="hp-alert-icon" />
                <div className="hp-alert-content">
                  <strong>Check-In Rejected</strong>
                  <p>{lastError}</p>
                </div>
              </div>
            ) : null}

            {/* Already Checked-In Notice */}
            {alreadyCheckedInNotice && (
              <div className="hp-checkin-alert hp-alert-notice">
                <FaInfoCircle className="hp-alert-icon" />
                <div className="hp-alert-content">
                  <strong>Already Checked In</strong>
                  <p>{alreadyCheckedInNotice.message}</p>
                </div>
                <button
                  type="button"
                  className="hp-btn hp-btn-sm hp-btn-outline"
                  onClick={() => handlePrintSlip(alreadyCheckedInNotice.appointment)}
                >
                  <FaPrint /> Print Slip
                </button>
              </div>
            )}

            {/* Success Result Display Card */}
            {lastResult && !lastResult.alreadyCheckedIn ? (
              <div className="hp-checkin-alert hp-alert-success">
                <div className="hp-success-top">
                  <div className="hp-success-badge">
                    <FaCheckCircle /> CHECK-IN VERIFIED
                  </div>
                  <button
                    type="button"
                    className="hp-print-slip-btn"
                    onClick={() => handlePrintSlip(lastResult.appointment)}
                  >
                    <FaPrint /> Print Token Slip
                  </button>
                </div>

                <div className="hp-token-hero">
                  <span className="hp-token-hero-lbl">ASSIGNED QUEUE TOKEN</span>
                  <span className="hp-token-hero-val">{lastResult.token}</span>
                  <span className="hp-token-hero-sub">
                    Direct patient to{" "}
                    <strong>
                      {lastResult.appointment?.doctorSpeciality ||
                        lastResult.appointment?.department ||
                        "General"}
                    </strong>{" "}
                    OPD Waiting Lounge
                  </span>
                </div>

                <div className="hp-result-details-grid">
                  <div>
                    <span className="hp-rd-label">PATIENT NAME</span>
                    <strong className="hp-rd-val">
                      {lastResult.appointment?.patientName || "Verified Patient"}
                    </strong>
                  </div>
                  <div>
                    <span className="hp-rd-label">PHONE</span>
                    <strong className="hp-rd-val">
                      {lastResult.appointment?.patientPhone || "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="hp-rd-label">DOCTOR</span>
                    <strong className="hp-rd-val">
                      {formatDoctorName(lastResult.appointment?.doctorName)}
                    </strong>
                  </div>
                  <div>
                    <span className="hp-rd-label">DEPARTMENT</span>
                    <strong className="hp-rd-val">
                      {lastResult.appointment?.doctorSpeciality ||
                        lastResult.appointment?.department ||
                        "General OPD"}
                    </strong>
                  </div>
                  <div>
                    <span className="hp-rd-label">SLOT TIME</span>
                    <strong className="hp-rd-val">
                      {lastResult.appointment?.slotTime || "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="hp-rd-label">CHECK-IN TIME</span>
                    <strong className="hp-rd-val">
                      {lastResult.appointment?.checkInAt
                        ? new Date(lastResult.appointment.checkInAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Just now"}
                    </strong>
                  </div>
                </div>

                <div className="hp-success-actions">
                  <button
                    type="button"
                    className="hp-btn hp-btn-outline hp-btn-block"
                    onClick={() => {
                      setLastResult(null);
                      setAlreadyCheckedInNotice(null);
                      setTokenInput("");
                    }}
                  >
                    Scan Next Patient
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* 4. Right Column: Today's Recent Arrivals */}
          <div className="hp-panel hp-recent-checkins-card">
            <div className="hp-panel-head">
              <div>
                <h3>Today's Recent Arrivals</h3>
                <p>Live stream of verified arrivals at hospital reception</p>
              </div>
              <span className="hp-badge hp-badge-neutral">
                {recentCheckIns.length} recorded
              </span>
            </div>

            {recentCheckIns.length === 0 ? (
              <div className="hp-empty-recent">
                <FaUserCheck className="hp-empty-icon" />
                <h4>No Arrivals Recorded Yet</h4>
                <p>No patients have checked in during this session.</p>
                <small>Scanned arrivals will show up here automatically in real time.</small>
              </div>
            ) : (
              <div className="hp-recent-list">
                {recentCheckIns.map((item, idx) => (
                  <div key={item._id || idx} className="hp-recent-item">
                    <div className="hp-recent-token-chip">
                      {item.queueToken || "A-000"}
                    </div>
                    <div className="hp-recent-info">
                      <strong className="hp-recent-name">
                        {item.patientName || "Patient"}
                      </strong>
                      <span className="hp-recent-meta">
                        {formatDoctorName(item.doctorName)} •{" "}
                        {item.doctorSpeciality || item.department || "OPD"}
                      </span>
                    </div>
                    <div className="hp-recent-right">
                      <span className="hp-recent-time">
                        <FaClock />{" "}
                        {item.checkInAt
                          ? new Date(item.checkInAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Now"}
                      </span>
                      <button
                        type="button"
                        className="hp-reprint-btn"
                        onClick={() => handlePrintSlip(item)}
                        title="Print token slip"
                      >
                        <FaPrint />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ---------------- Live Operational Queue Overview Tab ---------------- */
        <div className="hp-queue-overview-container">
          {/* Summary KPI Cards */}
          <div className="hp-queue-kpi-grid">
            <div className="hp-kpi-card">
              <span className="hp-kpi-label">TOTAL TODAY</span>
              <span className="hp-kpi-value">
                {queueData?.summary?.totalToday ?? 0}
              </span>
              <span className="hp-kpi-sub">Booked appointments</span>
            </div>
            <div className="hp-kpi-card hp-kpi-emerald">
              <span className="hp-kpi-label">CHECKED IN</span>
              <span className="hp-kpi-value">
                {queueData?.summary?.checkedInCount ?? 0}
              </span>
              <span className="hp-kpi-sub">Present at hospital</span>
            </div>
            <div className="hp-kpi-card hp-kpi-amber">
              <span className="hp-kpi-label">WAITING IN OPD</span>
              <span className="hp-kpi-value">
                {queueData?.summary?.waitingCount ?? 0}
              </span>
              <span className="hp-kpi-sub">In queue for doctor</span>
            </div>
            <div className="hp-kpi-card hp-kpi-cyan">
              <span className="hp-kpi-label">IN CONSULTATION</span>
              <span className="hp-kpi-value">
                {queueData?.summary?.inConsultationCount ?? 0}
              </span>
              <span className="hp-kpi-sub">With physician now</span>
            </div>
            <div className="hp-kpi-card hp-kpi-blue">
              <span className="hp-kpi-label">COMPLETED</span>
              <span className="hp-kpi-value">
                {queueData?.summary?.completedCount ?? 0}
              </span>
              <span className="hp-kpi-sub">Finished today</span>
            </div>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="hp-panel hp-queue-toolbar">
            <div className="hp-search-box">
              <FaSearch />
              <input
                type="text"
                placeholder="Search by patient, token (A-101), or doctor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="hp-clear-btn"
                  onClick={() => setSearchQuery("")}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="hp-filter-actions">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="hp-select"
              >
                <option value="all">All Queue Statuses</option>
                <option value="waiting">Waiting Only</option>
                <option value="in_consultation">In Consultation Only</option>
                <option value="completed">Completed</option>
              </select>

              <button
                type="button"
                className="hp-btn hp-btn-outline"
                onClick={loadQueueOverview}
                disabled={queueLoading}
                title="Refresh live queue"
              >
                <FaSyncAlt className={queueLoading ? "hp-spin" : ""} /> Refresh
              </button>
            </div>
          </div>

          {/* Queue Appointments Table */}
          <div className="hp-panel hp-queue-table-card">
            {queueLoading ? (
              <div className="hp-table-loading">
                <FaSyncAlt className="hp-spin" /> Loading live hospital queue...
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="hp-empty-state">
                <FaUserInjured className="hp-empty-icon" />
                <h3>No Appointments in Queue</h3>
                <p>No patients match the selected queue filters for today.</p>
              </div>
            ) : (
              <div className="hp-table-responsive">
                <table className="hp-table">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Patient Name</th>
                      <th>Phone</th>
                      <th>Assigned Doctor</th>
                      <th>Department</th>
                      <th>Slot Time</th>
                      <th>Check-In Time</th>
                      <th>Queue Status</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.map((item) => (
                      <tr key={item._id}>
                        <td>
                          <span className="hp-table-token">
                            {item.queueToken || "—"}
                          </span>
                        </td>
                        <td>
                          <strong>{item.patientName || "Patient"}</strong>
                        </td>
                        <td>{item.patientPhone || "—"}</td>
                        <td>{formatDoctorName(item.doctorName)}</td>
                        <td>{item.department || item.doctorSpeciality || "General"}</td>
                        <td>{item.slotTime || "—"}</td>
                        <td>
                          {item.checkInAt
                            ? new Date(item.checkInAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td>
                          <span
                            className={`hp-status-pill ${
                              item.queueStatus === "called"
                                ? "amber"
                                : item.queueStatus === "in_consultation"
                                  ? "cyan"
                                  : item.queueStatus === "completed"
                                    ? "blue"
                                    : item.checkedIn
                                      ? "emerald"
                                      : "neutral"
                            }`}
                          >
                            {item.queueStatus === "called"
                              ? "Called to Room"
                              : item.queueStatus === "in_consultation"
                                ? "In Consultation"
                                : item.queueStatus === "completed"
                                  ? "Completed"
                                  : item.checkedIn
                                    ? "Waiting in OPD"
                                    : "Not Checked In"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="hp-btn hp-btn-sm hp-btn-outline"
                            onClick={() => handlePrintSlip(item)}
                            title="Print Token Slip"
                          >
                            <FaPrint />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
