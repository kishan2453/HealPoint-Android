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

