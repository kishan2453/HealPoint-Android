/**
 * HealPoint Mobile — In-App WebRTC Video Consultation Room.
 *
 * Professional, real-time, peer-to-peer WebRTC consultation room.
 * Built for Expo SDK 54 using `react-native-webview`.
 * Features:
 *  - Real P2P WebRTC audio & video streaming with doctor
 *  - Token-authorized Socket.IO signaling with backend ICE/STUN/TURN
 *  - Camera on/off, microphone mute, front/back camera flip
 *  - Live consultation elapsed timer
 *  - Automatic reconnection handling
 *  - Seamless fallback to Google Meet if desired
 *  - Automatic duration logging and session completion
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState, useRef } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { Palette } from "@/constants/theme";
import { openGoogleMeetUrl } from "@/lib/meet";
import * as consultationService from "@/services/consultations";
import { getSocketServerUrl } from "@/services/socket";

interface InAppVideoConsultationModalProps {
  visible: boolean;
  appointmentId: string;
  doctorName?: string;
  doctorSpecialty?: string;
  meetingUrl?: string;
  onClose: () => void;
  onCompleted?: () => void;
}

export function InAppVideoConsultationModal({
  visible,
  appointmentId,
  doctorName = "Doctor",
  doctorSpecialty = "Specialist",
  meetingUrl,
  onClose,
  onCompleted,
}: InAppVideoConsultationModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] =
    useState<consultationService.ConsultationSessionData | null>(null);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    let active = true;

    if (visible && appointmentId) {
      setLoading(true);
      setError(null);

      consultationService
        .createConsultationSession(appointmentId)
        .then((data) => {
          if (!active) return;
          if (data.success && data.sessionToken) {
            setSession(data);
            setLoading(false);
          } else {
            setError(data.message || "Failed to initialize consultation session");
            setLoading(false);
          }
        })
        .catch((err) => {
          if (!active) return;
          setError(
            err?.message ||
              "Unable to connect to the consultation server. Please check your network."
          );
          setLoading(false);
        });
    } else {
      setSession(null);
      setLoading(false);
      setError(null);
    }

    return () => {
      active = false;
    };
  }, [visible, appointmentId]);

  if (!visible) return null;

  const serverUrl = getSocketServerUrl();
  const iceServersJson = JSON.stringify(
    session?.iceServers || [{ urls: "stun:stun.l.google.com:19302" }]
  );

  // Generate self-contained WebRTC HTML5 Client for WebView
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>HealPoint Video Consultation</title>
  <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html { width: 100%; height: 100%; background: #0b1120; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow: hidden; color: #fff; }
    
    #container { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; }
    
    /* Top Bar */
    #topBar {
      position: absolute; top: 0; left: 0; right: 0; height: 60px;
      padding: 0 16px; display: flex; align-items: center; justify-content: space-between;
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(15, 23, 42, 0) 100%);
      z-index: 20;
    }
    .doc-info { display: flex; flex-direction: column; }
    .doc-name { font-weight: 700; font-size: 15px; color: #f8fafc; }
    .doc-spec { font-size: 12px; color: #94a3b8; }
    .timer-badge { background: rgba(30, 41, 59, 0.85); border: 1px solid #334155; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; color: #38bdf8; display: flex; align-items: center; gap: 6px; }
    .pulse-dot { width: 8px; height: 8px; border-radius: 4px; background: #22c55e; }

    /* Remote Video (Doctor) */
    #remoteVideoContainer {
      position: absolute; inset: 0; width: 100%; height: 100%; background: #0f172a;
      display: flex; align-items: center; justify-content: center; z-index: 1;
    }
    #remoteVideo { width: 100%; height: 100%; object-fit: cover; }
    .waiting-remote { display: flex; flex-direction: column; align-items: center; gap: 12px; color: #94a3b8; text-align: center; padding: 24px; }
    .spinner { border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid #38bdf8; border-radius: 50%; width: 36px; height: 36px; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    /* Local Video (Patient PiP) */
    #localVideoContainer {
      position: absolute; right: 16px; top: 72px; width: 110px; height: 160px;
      border-radius: 12px; overflow: hidden; background: #1e293b; border: 2px solid #38bdf8;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5); z-index: 30;
    }
    #localVideo { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }

    /* Bottom Control Dock */
    #dock {
      position: absolute; bottom: 0; left: 0; right: 0; height: 90px;
      padding: 0 16px 20px; display: flex; align-items: center; justify-content: center; gap: 14px;
      background: linear-gradient(0deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0) 100%);
      z-index: 20;
    }
    .ctrl-btn {
      width: 48px; height: 48px; border-radius: 24px; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center; font-size: 18px; color: #fff;
      background: rgba(51, 65, 85, 0.85); box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: background 0.2s; -webkit-tap-highlight-color: transparent;
    }
    .ctrl-btn.off { background: #ef4444; color: #fff; }
    .ctrl-btn.end { background: #dc2626; width: 56px; height: 56px; border-radius: 28px; }
    .ctrl-btn.meet { background: #0284c7; }

    /* Reconnection alert */
    #reconnectBanner {
      display: none; position: absolute; top: 68px; left: 16px; right: 16px;
      background: rgba(239, 68, 68, 0.9); padding: 8px 14px; border-radius: 8px;
      font-size: 13px; text-align: center; z-index: 40; font-weight: 500;
    }
  </style>
</head>
<body>
  <div id="container">
    <div id="topBar">
      <div class="doc-info">
        <span class="doc-name">${doctorName}</span>
        <span class="doc-spec">${doctorSpecialty}</span>
      </div>
      <div class="timer-badge">
        <div class="pulse-dot"></div>
        <span id="callDuration">00:00</span>
      </div>
    </div>

    <div id="reconnectBanner">Connection lost. Reconnecting…</div>

    <div id="remoteVideoContainer">
      <div id="remotePlaceholder" class="waiting-remote">
        <div class="spinner"></div>
        <strong>Waiting for doctor to connect…</strong>
        <p style="font-size: 12px;">Your video and audio are live. The doctor has been notified.</p>
      </div>
      <video id="remoteVideo" autoplay playsinline style="display:none;"></video>
    </div>

    <div id="localVideoContainer">
      <video id="localVideo" autoplay playsinline muted></video>
    </div>

    <div id="dock">
      <!-- Mic toggle -->
      <button id="btnMic" class="ctrl-btn" onclick="toggleMic()">🎤</button>
      <!-- Camera toggle -->
      <button id="btnCam" class="ctrl-btn" onclick="toggleCamera()">📹</button>
      <!-- Flip camera -->
      <button id="btnFlip" class="ctrl-btn" onclick="flipCamera()">🔄</button>
      ${
        meetingUrl
          ? `<button id="btnMeet" class="ctrl-btn meet" onclick="requestGoogleMeet()" title="Google Meet">G</button>`
          : ""
      }
      <!-- End Call -->
      <button id="btnEnd" class="ctrl-btn end" onclick="endCall()">📞</button>
    </div>
  </div>

  <script>
    const appointmentId = "${appointmentId}";
    const sessionToken = "${session?.sessionToken || ""}";
    const serverUrl = "${serverUrl}";
    const iceServers = ${iceServersJson};
    
    let localStream = null;
    let peerConnection = null;
    let socket = null;
    let micMuted = false;
    let cameraOff = false;
    let facingMode = "user";
    let elapsedSeconds = 0;
    let timerInterval = null;

    function postToNative(type, payload = {}) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...payload }));
      }
    }

    function updateTimerDisplay() {
      elapsedSeconds++;
      const m = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
      const s = String(elapsedSeconds % 60).padStart(2, '0');
      document.getElementById('callDuration').innerText = m + ':' + s;
    }

    async function initCall() {
      try {
        // 1. Get user media
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true
        });
        document.getElementById('localVideo').srcObject = localStream;
      } catch (err) {
        console.warn('Media capture error:', err);
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
          postToNative('error', { message: 'Camera and microphone access denied' });
          return;
        }
      }

      // 2. Setup RTCPeerConnection
      peerConnection = new RTCPeerConnection({ iceServers: iceServers });

      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const rVid = document.getElementById('remoteVideo');
          rVid.srcObject = event.streams[0];
          rVid.style.display = 'block';
          document.getElementById('remotePlaceholder').style.display = 'none';
          if (!timerInterval) {
            timerInterval = setInterval(updateTimerDisplay, 1000);
          }
        }
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('consultation:signal', {
            appointmentId: appointmentId,
            signalData: { type: 'candidate', candidate: event.candidate }
          });
        }
      };

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        if (state === 'disconnected' || state === 'failed') {
          document.getElementById('reconnectBanner').style.display = 'block';
        } else if (state === 'connected') {
          document.getElementById('reconnectBanner').style.display = 'none';
        }
      };

      // 3. Connect Socket.IO
      socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        auth: { token: sessionToken }
      });

      socket.on('connect', () => {
        socket.emit('consultation:join-room', {
          appointmentId: appointmentId,
          sessionToken: sessionToken
        });
        socket.emit('consultation:waiting', { appointmentId: appointmentId });
      });

      socket.on('consultation:doctor_ready', () => {
        // Doctor is ready, create WebRTC offer if needed
      });

      socket.on('consultation:signal', async (data) => {
        if (!data || !data.signalData) return;
        const sig = data.signalData;

        try {
          if (sig.type === 'offer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(sig));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('consultation:signal', {
              appointmentId: appointmentId,
              signalData: answer
            });
          } else if (sig.type === 'answer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(sig));
          } else if (sig.type === 'candidate') {
            await peerConnection.addIceCandidate(new RTCIceCandidate(sig.candidate));
          }
        } catch (sigErr) {
          console.error('Signal handling error:', sigErr);
        }
      });
    }

    function toggleMic() {
      if (!localStream) return;
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        micMuted = !audioTrack.enabled;
        const btn = document.getElementById('btnMic');
        if (micMuted) {
          btn.classList.add('off');
          btn.innerText = '🔇';
        } else {
          btn.classList.remove('off');
          btn.innerText = '🎤';
        }
      }
    }

    function toggleCamera() {
      if (!localStream) return;
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        cameraOff = !videoTrack.enabled;
        const btn = document.getElementById('btnCam');
        if (cameraOff) {
          btn.classList.add('off');
          btn.innerText = '📷';
        } else {
          btn.classList.remove('off');
          btn.innerText = '📹';
        }
      }
    }

    async function flipCamera() {
      if (!localStream) return;
      facingMode = facingMode === 'user' ? 'environment' : 'user';
      try {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.stop();
          localStream.removeTrack(videoTrack);
        }
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 } }
        });
        const newTrack = newStream.getVideoTracks()[0];
        localStream.addTrack(newTrack);
        document.getElementById('localVideo').srcObject = localStream;
        document.getElementById('localVideo').style.transform = facingMode === 'user' ? 'scaleX(-1)' : 'none';

        const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(newTrack);
        }
      } catch (err) {
        console.warn('Camera flip error:', err);
      }
    }

    function requestGoogleMeet() {
      postToNative('open_google_meet');
    }

    function endCall() {
      if (timerInterval) clearInterval(timerInterval);
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
      if (peerConnection) {
        peerConnection.close();
      }
      if (socket) {
        socket.emit('consultation:leave', { appointmentId: appointmentId });
        socket.disconnect();
      }
      postToNative('end_call', { durationSeconds: elapsedSeconds });
    }

    // Start on load
    window.addEventListener('DOMContentLoaded', initCall);
  </script>
</body>
</html>
`;

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "end_call") {
        if (data.durationSeconds > 0) {
          consultationService
            .updateConsultationStatus(
              appointmentId,
              "completed",
              data.durationSeconds
            )
            .catch(() => null);
        }
        if (onCompleted) onCompleted();
        onClose();
      } else if (data.type === "open_google_meet") {
        if (meetingUrl) {
          openGoogleMeetUrl(meetingUrl);
          onClose();
        } else {
          Alert.alert(
            "Google Meet Not Available",
            "Doctor has not provided a Google Meet link for this session."
          );
        }
      } else if (data.type === "error") {
        Alert.alert("Consultation Notice", data.message || "An error occurred");
      }
    } catch {
      // Ignore parse errors
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        Alert.alert(
          "Leave Video Call?",
          "Are you sure you want to leave the consultation?",
          [
            { text: "Stay", style: "cancel" },
            {
              text: "Leave Call",
              style: "destructive",
              onPress: onClose,
            },
          ]
        );
      }}
    >
      <SafeAreaView style={styles.modalContainer} edges={["top", "bottom"]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Palette.primary} />
            <Text style={styles.loadingTitle}>Connecting to Video Room</Text>
            <Text style={styles.loadingSub}>
              Securing end-to-end medical session with {doctorName}…
            </Text>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : error ? (
          <View style={styles.loadingContainer}>
            <Ionicons name="alert-circle" size={48} color={Palette.error} />
            <Text style={styles.errorTitle}>Unable to Join</Text>
            <Text style={styles.errorSub}>{error}</Text>
            {meetingUrl ? (
              <TouchableOpacity
                style={styles.meetFallbackBtn}
                onPress={() => {
                  openGoogleMeetUrl(meetingUrl);
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="videocam" size={18} color="#fff" />
                <Text style={styles.meetFallbackBtnText}>
                  Use Google Meet Fallback
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ html: htmlContent, baseUrl: serverUrl }}
            originWhitelist={["*"]}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grant"
            javaScriptEnabled={true}
            domStorageEnabled={true}
            onMessage={handleMessage}
            style={styles.webview}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "#0b1120",
  },
  webview: {
    flex: 1,
    backgroundColor: "#0b1120",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#0b1120",
  },
  loadingTitle: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: "700",
    color: "#f8fafc",
  },
  loadingSub: {
    marginTop: 8,
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "700",
    color: Palette.error,
  },
  errorSub: {
    marginTop: 8,
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  meetFallbackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0284c7",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  meetFallbackBtnText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
  },
  cancelBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: "#94a3b8",
    fontWeight: "600",
    fontSize: 14,
  },
});

