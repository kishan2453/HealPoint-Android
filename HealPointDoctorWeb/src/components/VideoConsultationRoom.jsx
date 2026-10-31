import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  FaVideo,
  FaVideoSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaPhoneSlash,
  FaUserMd,
  FaUser,
  FaClock,
  FaNotesMedical,
  FaExternalLinkAlt,
  FaCircle,
  FaShieldAlt,
} from "react-icons/fa";
import { toast } from "react-toastify";
import api from "../services/api";
import { getDoctorSocket } from "../services/socket";

export default function VideoConsultationRoom({
  appointmentId,
  doctorId,
  onClose,
  onCompleted,
}) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Media states
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("initializing"); // initializing | waiting | connecting | connected | disconnected | failed

  // Consultation timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // In-consultation clinical notes
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [generatingAiSummary, setGeneratingAiSummary] = useState(false);

  // Video element refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // WebRTC refs
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const socketRef = useRef(null);

  // Initialize Consultation Session and WebRTC
  useEffect(() => {
    let mounted = true;
    let timerInterval = null;

    async function initSession() {
      try {
        setLoading(true);
        setError("");

        // 1. Authenticate with backend and obtain short-lived session token & ICE servers
        const res = await api.post(`/api/v1/consultation/session/${appointmentId}/create`);
        if (!mounted) return;

        const sessionData = res.data;
        setSession(sessionData);

        // 2. Access local camera and microphone
        let localStream;
        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true,
          });
          localStreamRef.current = localStream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
          }
        } catch (mediaErr) {
          console.warn("[WebRTC] Media device error:", mediaErr);
          toast.warning("Camera or microphone permission was denied. You may still connect in audio-only mode.");
          // Try audio only fallback
          try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = localStream;
          } catch {
            // No media devices available
          }
        }

        // 3. Connect WebRTC Peer Connection with backend STUN/TURN servers
        const iceServers = sessionData.iceServers || [
          { urls: "stun:stun.l.google.com:19302" },
        ];
        const pc = new RTCPeerConnection({ iceServers });
        peerConnectionRef.current = pc;

        // Add local tracks to peer connection
        if (localStream) {
          localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
        }

        // Handle incoming remote tracks from patient
        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            remoteStreamRef.current = event.streams[0];
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = event.streams[0];
            }
            setConnectionStatus("connected");
          }
        };

        // ICE candidate handler
        pc.onicecandidate = (event) => {
          if (event.candidate && socketRef.current) {
            socketRef.current.emit("consultation:signal", {
              appointmentId,
              signalData: { type: "candidate", candidate: event.candidate },
            });
          }
        };

        // Connection state change
        pc.onconnectionstatechange = () => {
          const state = pc.connectionState;
          if (state === "connected") {
            setConnectionStatus("connected");
            // Start duration timer
            if (!timerInterval) {
              timerInterval = setInterval(() => {
                setElapsedSeconds((prev) => prev + 1);
              }, 1000);
            }
          } else if (state === "disconnected" || state === "failed") {
            setConnectionStatus("disconnected");
          }
        };

        // 4. Socket.IO Signaling integration
        const socket = getDoctorSocket();
        socketRef.current = socket;

        if (socket) {
          // Join consultation room
          socket.emit(
            "consultation:join-room",
            {
              appointmentId,
              sessionToken: sessionData.sessionToken,
            },
            (ack) => {
              if (ack && ack.success) {
                setConnectionStatus("waiting");
                // Notify waiting room that doctor is ready
                socket.emit("consultation:doctor_ready", {
                  appointmentId,
                  userId: sessionData.appointment?.patient?._id,
                });
              } else {
                toast.error(ack?.message || "Failed to join consultation room");
              }
            }
          );

          // Listen for patient joining the room
          socket.on("consultation:peer-joined", async (peer) => {
            toast.info("Patient joined the room. Establishing connection...");
            setConnectionStatus("connecting");

            // Doctor acts as offer initiator
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socket.emit("consultation:signal", {
                appointmentId,
                targetPeerId: peer.peerId,
                signalData: { type: "offer", sdp: offer },
              });
            } catch (err) {
              console.error("[WebRTC] Create offer error:", err);
            }
          });

          // Handle incoming WebRTC signals
          socket.on("consultation:signal", async ({ fromPeerId, signalData }) => {
            if (!signalData) return;

            try {
              if (signalData.type === "offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit("consultation:signal", {
                  appointmentId,
                  targetPeerId: fromPeerId,
                  signalData: { type: "answer", sdp: answer },
                });
              } else if (signalData.type === "answer") {
                await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
                setConnectionStatus("connected");
              } else if (signalData.type === "candidate") {
                if (signalData.candidate) {
                  await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
                }
              }
            } catch (sigErr) {
              console.warn("[WebRTC] Signal handling error:", sigErr);
            }
          });

          // Handle patient leaving
          socket.on("consultation:peer-left", () => {
            toast.warn("Patient disconnected from consultation");
            setConnectionStatus("disconnected");
          });
        }
      } catch (err) {
        if (!mounted) return;
        setError(err?.response?.data?.message || err.message || "Unable to start video consultation");
        toast.error("Video room error: " + (err?.response?.data?.message || err.message));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initSession();

    return () => {
      mounted = false;
      if (timerInterval) clearInterval(timerInterval);

      // Stop local media tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      // Leave socket room
      if (socketRef.current) {
        socketRef.current.emit("consultation:leave", { appointmentId });
        socketRef.current.off("consultation:peer-joined");
        socketRef.current.off("consultation:signal");
        socketRef.current.off("consultation:peer-left");
      }
    };
  }, [appointmentId]);

  // Toggle Microphone
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle Camera
  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraOff(!videoTrack.enabled);
      }
    }
  };

  // Save Clinical Notes
  const handleSaveNotes = async () => {
    if (!clinicalNotes.trim()) return;
    setSavingNotes(true);
    try {
      await api.post(`/api/v1/consultation/session/${appointmentId}/notes`, {
        notes: clinicalNotes.trim(),
      });
      toast.success("Consultation notes saved securely");
    } catch (err) {
      toast.error("Failed to save notes: " + (err?.response?.data?.message || err.message));
    } finally {
      setSavingNotes(false);
    }
  };

  // Generate AI Summary Draft
  const handleGenerateAiSummary = async () => {
    setGeneratingAiSummary(true);
    try {
      const res = await api.post(`/api/v1/ai/consultation-summary/${appointmentId}`);
      if (res.data && res.data.summary) {
        setClinicalNotes((prev) => (prev ? `${prev}\n\n${res.data.summary}` : res.data.summary));
        toast.info("AI draft summary generated. Please review and edit before saving.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to generate AI consultation summary");
    } finally {
      setGeneratingAiSummary(false);
    }
  };

  // End Consultation
  const handleEndConsultation = async () => {
    const confirm = window.confirm("Are you sure you want to end this consultation and mark it completed?");
    if (!confirm) return;

    try {
      await api.patch(`/api/v1/consultation/session/${appointmentId}/status`, {
        status: "completed",
        notes: clinicalNotes.trim() || undefined,
      });

      toast.success("Consultation successfully completed");

      if (typeof onCompleted === "function") {
        onCompleted(session?.appointment);
      } else if (typeof onClose === "function") {
        onClose();
      }
    } catch (err) {
      toast.error("Failed to end consultation: " + (err?.response?.data?.message || err.message));
    }
  };

  const formatTimer = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="dp-video-room-overlay" style={styles.overlay}>
      <div className="dp-video-room-container" style={styles.container}>
        {/* Top Header Bar */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.badgeLive}>
              <FaCircle size={10} color="#10b981" />
              <span style={{ fontWeight: 700, fontSize: 13, marginLeft: 6 }}>
                HEALPOINT SECURE TELEHEALTH
              </span>
            </div>
            <span style={styles.patientTag}>
              Patient: <strong>{session?.appointment?.patient?.name || "Patient"}</strong>
            </span>
          </div>

          <div style={styles.headerRight}>
            <div style={styles.timerBadge}>
              <FaClock style={{ marginRight: 6 }} />
              <span>{formatTimer(elapsedSeconds)}</span>
            </div>

            {/* Google Meet Fallback Link */}
            {session?.meetingUrl ? (
              <a
                href={session.meetingUrl}
                target="_blank"
                rel="noreferrer"
                style={styles.btnMeetFallback}
                title="Switch to Google Meet backup link"
              >
                <FaExternalLinkAlt style={{ marginRight: 6 }} /> Google Meet Fallback
              </a>
            ) : null}

            <button onClick={onClose} style={styles.btnClose}>
              Exit Room
            </button>
          </div>
        </div>

        {/* Video Stage & Side Panel */}
        <div style={styles.stageGrid}>
          {/* Main Video Window (Remote Patient Stream) */}
          <div style={styles.mainVideoWrapper}>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={styles.remoteVideo}
            />

            {/* Status Overlay if not yet connected */}
            {connectionStatus !== "connected" && (
              <div style={styles.waitingOverlay}>
                <div style={styles.waitingCard}>
                  <div style={styles.avatarCircle}>
                    <FaUser size={40} color="#94a3b8" />
                  </div>
                  <h3 style={{ margin: "16px 0 6px 0", color: "#0f172a" }}>
                    {connectionStatus === "waiting"
                      ? "Waiting for Patient to Enter..."
                      : connectionStatus === "connecting"
                      ? "Connecting Secure P2P Stream..."
                      : connectionStatus === "disconnected"
                      ? "Patient Disconnected"
                      : "Initializing Consultation Room..."}
                  </h3>
                  <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
                    {connectionStatus === "waiting"
                      ? "The patient has been notified. As soon as they enter, live video will start automatically."
                      : "End-to-End Encrypted WebRTC Consultation"}
                  </p>
                </div>
              </div>
            )}

            {/* Floating PiP Mini Video (Doctor's Local Feed) */}
            <div style={styles.localPipWrapper}>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={styles.localVideo}
              />
              <span style={styles.pipLabel}>You (Doctor)</span>
            </div>
          </div>

          {/* Right Clinical Notes & Prescribe Drawer */}
          <div style={styles.sideNotesPanel}>
            <div style={styles.notesHeader}>
              <FaNotesMedical color="#2563eb" style={{ marginRight: 8 }} />
              <h4 style={{ margin: 0 }}>Consultation Notes & EMR</h4>
            </div>

            <button
              type="button"
              onClick={handleGenerateAiSummary}
              disabled={generatingAiSummary}
              style={{
                backgroundColor: "#0f172a",
                color: "#60a5fa",
                border: "1px solid #3b82f6",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              ✨ {generatingAiSummary ? "Drafting Summary..." : "AI Consultation Summary Draft"}
            </button>

            <textarea
              style={styles.notesTextarea}
              placeholder="Record chief complaints, diagnosis, vitals, or clinical advice here during the consultation..."
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              rows={8}
            />

            <button
              onClick={handleSaveNotes}
              disabled={savingNotes || !clinicalNotes.trim()}
              style={styles.btnSaveNotes}
            >
              {savingNotes ? "Saving..." : "Save Clinical Notes"}
            </button>

            <div style={styles.encryptionCard}>
              <FaShieldAlt color="#0284c7" size={18} style={{ marginRight: 8 }} />
              <p style={{ margin: 0, fontSize: 12, color: "#475569" }}>
                Session encrypted via DTLS-SRTP. Zero unconsented video or audio recording.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Control Dock */}
        <div style={styles.dock}>
          <button
            onClick={toggleMic}
            style={{
              ...styles.dockBtn,
              backgroundColor: micMuted ? "#ef4444" : "#334155",
            }}
            title={micMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {micMuted ? <FaMicrophoneSlash size={20} color="#fff" /> : <FaMicrophone size={20} color="#fff" />}
          </button>

          <button
            onClick={toggleCamera}
            style={{
              ...styles.dockBtn,
              backgroundColor: cameraOff ? "#ef4444" : "#334155",
            }}
            title={cameraOff ? "Turn On Camera" : "Turn Off Camera"}
          >
            {cameraOff ? <FaVideoSlash size={20} color="#fff" /> : <FaVideo size={20} color="#fff" />}
          </button>

          <button
            onClick={handleEndConsultation}
            style={styles.btnEndCall}
            title="End Consultation & Complete"
          >
            <FaPhoneSlash size={20} style={{ marginRight: 8 }} />
            <span>End Consultation</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(8px)",
  },
  container: {
    width: "95vw",
    height: "92vh",
    backgroundColor: "#0f172a",
    borderRadius: 16,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    border: "1px solid #1e293b",
  },
  header: {
    padding: "16px 24px",
    backgroundColor: "#1e293b",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #334155",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  badgeLive: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    color: "#10b981",
    padding: "6px 12px",
    borderRadius: 9999,
  },
  patientTag: {
    color: "#f8fafc",
    fontSize: 14,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  timerBadge: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "#0f172a",
    color: "#38bdf8",
    padding: "6px 14px",
    borderRadius: 8,
    fontFamily: "monospace",
    fontSize: 15,
    fontWeight: 700,
  },
  btnMeetFallback: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "#334155",
    color: "#93c5fd",
    textDecoration: "none",
    padding: "6px 12px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
  },
  btnClose: {
    backgroundColor: "transparent",
    color: "#94a3b8",
    border: "1px solid #475569",
    padding: "6px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
  },
  stageGrid: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "1fr 340px",
    overflow: "hidden",
  },
  mainVideoWrapper: {
    position: "relative",
    backgroundColor: "#000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  remoteVideo: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  waitingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.85)",
  },
  waitingCard: {
    backgroundColor: "#ffffff",
    padding: 32,
    borderRadius: 16,
    textAlign: "center",
    maxWidth: 420,
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f1f5f9",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  localPipWrapper: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 220,
    height: 140,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
    border: "2px solid #38bdf8",
  },
  localVideo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: "scaleX(-1)", // Mirror local feed
  },
  pipLabel: {
    position: "absolute",
    bottom: 6,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    color: "#fff",
    fontSize: 11,
    padding: "2px 6px",
    borderRadius: 4,
  },
  sideNotesPanel: {
    backgroundColor: "#1e293b",
    borderLeft: "1px solid #334155",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    color: "#f8fafc",
  },
  notesHeader: {
    display: "flex",
    alignItems: "center",
  },
  notesTextarea: {
    width: "100%",
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    border: "1px solid #334155",
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    fontFamily: "inherit",
    resize: "none",
    boxSizing: "border-box",
  },
  btnSaveNotes: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    padding: "10px 16px",
    fontWeight: 600,
    cursor: "pointer",
  },
  encryptionCard: {
    marginTop: "auto",
    padding: 12,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    display: "flex",
    alignItems: "flex-start",
    border: "1px solid #334155",
  },
  dock: {
    padding: "16px 24px",
    backgroundColor: "#1e293b",
    borderTop: "1px solid #334155",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  dockBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  btnEndCall: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "#dc2626",
    color: "#ffffff",
    border: "none",
    padding: "12px 24px",
    borderRadius: 24,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 15,
  },
};

