# HealPoint 2.0 — Deployment & Infrastructure Notes

**Phase:** Phase 1 (Live Queue Management)

---

## 1. Environment Variables Configuration

### Backend (`HealPointBackend/.env`)
```bash
# Existing variables
PORT=8080
NODE_ENV=production
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/doctorapp?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_production_jwt_key_here
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...

# Phase 1 Feature Flag (Default: false)
# Set to 'true' to activate real-time Socket.IO broadcasts & live queue recalculation
FEATURE_LIVE_QUEUE=false

# Multi-Instance Cluster Synchronization (Optional for single node / dev; Required for multi-instance clusters)
# Option A: Connection URI
REDIS_URL=redis://default:<password>@<redis-host>:6379

# Option B: Individual fields
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
```

---

## 2. Multi-Instance / Clustered Deployments

1. **Single Node / Development**:
   - If `REDIS_URL` or `REDIS_HOST` is omitted, `socketService.js` defaults to an in-memory adapter.
   - Live queue updates and socket events work within that instance.
2. **Multi-Instance / Production (Docker / Kubernetes / PM2 Cluster)**:
   - Provide a valid Redis instance (Redis v6+ or AWS ElastiCache / Redis Cloud).
   - `@socket.io/redis-adapter` automatically coordinates socket broadcasts across all backend pods/containers.
   - Socket sticky sessions (`cookie: false` with WebSocket transport preference) are configured.

---

## 3. Reverse Proxy & WebSocket Configuration (Nginx / Cloudflare)

When deploying behind Nginx or an Application Load Balancer, ensure WebSocket upgrades are enabled:

```nginx
location /socket.io/ {
    proxy_pass http://127.0.0.1:8080/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
```

---

## 4. Production Hosting & Live Deployments Matrix

All HealPoint 2.0 services and portals are linked to Vercel and EAS:

| Service / Portal | Hosting Platform | Vercel Project ID / Slug | Production Live URL | Status |
|---|---|---|---|---|
| **Backend API Server** | Vercel Serverless + MongoDB Atlas | `prj_sMDbW8j2ckLwxsVm8EiyOOiPE4sW` (`heal-point-backend`) | `https://heal-point-backend.vercel.app` | **LIVE (200 OK, DB Connected)** |
| **Patient Web Portal** | Vercel Static + PWA | `prj_5DKUjrv0rAF1h4eVFAUdvAUJp9ue` (`heal-point`) | `https://heal-point.vercel.app` | **LIVE (200 OK)** |
| **Doctor Portal** | Vercel + Vite React | `prj_j3ersIK40oLua2chbdaQ3VcQ5dwM` (`heal-point-doctor-web`) | `https://heal-point-doctor-web.vercel.app` | **LIVE (200 OK)** |
| **Hospital Admin Portal**| Vercel + Vite React | `prj_4eVpnXdjolM25NemsAb3m7y0H2If` (`heal-point-hospital-admin`) | `https://heal-point-hospital-admin.vercel.app` | **LIVE (200 OK)** |
| **Super Admin Portal** | Vercel + Vite React | `prj_Q2P0ZqFbjMAskLDB5m3M76X5nl5V` (`heal-point-super-admin`) | `https://heal-point-super-admin.vercel.app` | **LIVE (200 OK)** |
| **Android Patient App** | Expo Application Services (EAS) | `@kishan_2453/healpoint` | [Latest APK Artifact](https://expo.dev/artifacts/eas/0YWxIl8sr_PXrCZWfTWjqCphqg-0x7p0qI2zAQ6puAA.apk) | **BUILT (v1.0.0, code 5)** |

---

## 5. Android Build & Release Specifications

- **Expo SDK Version:** 54.0.0
- **Expo Doctor Validation:** 18/18 checks passed (`npx expo-doctor`)
- **Package Name:** `com.healpoint.app`
- **Latest Finished APK Build ID:** `d59486c6-3b19-4753-8a4e-dc1996a9b301`
- **Profile:** `apk-production` / `preview`
- **Application Archive URL:** `https://expo.dev/artifacts/eas/0YWxIl8sr_PXrCZWfTWjqCphqg-0x7p0qI2zAQ6puAA.apk`
- **Build Logs:** `https://expo.dev/accounts/kishan_2453/projects/healpoint/builds/d59486c6-3b19-4753-8a4e-dc1996a9b301`


