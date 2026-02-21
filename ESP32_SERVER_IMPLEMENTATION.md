# ESP32 Server Implementation Summary

## Overview
This document summarizes the complete server-side and dashboard implementation for the cluster-based IoT biometric attendance system with dual ESP32 devices per door.

## Architecture

### Cluster-Based Design
- **Two ESP32s per door**: 
  - **Entry Side**: ESP32-CAM with fingerprint sensor, camera (multi-person detection), buzzer
  - **Exit Side**: ESP32 with fingerprint sensor and relay for door control
- **MAC Address Identification**: Each device uniquely identified by hardware MAC address
- **Server-Controlled Door Unlocking**: Door unlock commands sent from server after validation
- **Real-Time Health Monitoring**: Heartbeat system with automatic offline detection

## Database Models

### 1. Device Model (`server/models/Device.js`)
Stores ESP32 device information with health metrics.

**Key Fields:**
- `deviceMAC` (unique): Hardware MAC address
- `deviceType`: ESP32, ESP32-CAM
- `clusterID`: Reference to cluster
- `deviceRole`: ENTRY or EXIT
- `scannerID`: Unique scanner identifier for enrollment
- `status`: PENDING, ACTIVE, OFFLINE, MAINTENANCE
- `capabilities`: Array (fingerprint, camera, relay, buzzer)
- `healthMetrics`: Uptime, WiFi signal, heap memory, sensor status

**Key Methods:**
- `isOnline()`: Returns true if heartbeat within 2 minutes
- `minutesSinceHeartbeat`: Virtual property

### 2. Cluster Model (`server/models/Cluster.js`)
Groups devices at the same physical door location.

**Key Fields:**
- `clusterID` (unique): Cluster identifier
- `clusterName`: Human-readable name
- `location`: Physical location
- `devices`: Array of { deviceMAC, role, scannerID }
- `doorControlDevice`: MAC address of EXIT device with relay
- `status`: OPERATIONAL, DEGRADED, OFFLINE, MAINTENANCE
- `unlockDuration`: Default unlock time in milliseconds

**Key Methods:**
- `getDeviceMACs()`: Returns array of all device MAC addresses
- `getDeviceByRole(role)`: Find device by ENTRY or EXIT

### 3. User Model Updates (`server/models/User.js`)
Enhanced with multi-scanner enrollment support.

**New Field:**
```javascript
enrollments: [{
  scannerID: String,
  deviceMAC: String,
  fingerprintId: Number,
  clusterID: String,
  enrolledAt: Date
}]
```

**Backward Compatibility:**
- Legacy `fingerprintId` field maintained
- Services check both enrollments array and legacy field

## Services

### 1. Device Health Service (`server/services/device/deviceHealthService.js`)

**Functions:**
- `processHeartbeat(event)`: Update device health metrics from HEARTBEAT events
- `updateClusterStatus(clusterID)`: Calculate cluster status based on online devices
- `autoOfflineDetection()`: Mark devices offline if no heartbeat for 2 minutes
- `getHealthSummary()`: Aggregate health statistics
- `getUnhealthyDevices()`: Query offline/maintenance devices
- `startAutoOfflineDetection(intervalMs)`: Start periodic health checks

**Real-Time Events:**
- Emits `device-heartbeat` with device health data
- Emits `cluster-status-update` when cluster status changes
- Emits `devices-offline` when batch offline detection occurs

### 2. Device Registration Service (`server/services/device/deviceRegistrationService.js`)

**Functions:**
- `registerDevice(deviceInfo)`: Create pending device entry
- `approveDevice(deviceMAC, config, adminUserId)`: Approve device and assign to cluster
- `rejectDevice(deviceMAC)`: Remove pending device
- `getPendingDevices()`: Query all pending devices

**Approval Workflow:**
1. ESP32 sends DEVICE_REGISTER event with MAC + capabilities
2. Service creates Device with PENDING status
3. Emits `device-pending-approval` to notify admins
4. Admin approves via UI, assigns clusterID, deviceRole, scannerID
5. Device updates to ACTIVE, added to cluster
6. Emits `device-approved` event

### 3. Recognition Service Updates (`server/services/pipelines/recognitionService.js`)

**Major Changes:**
- **Cluster-Aware Processing**: Extracts deviceMAC, clusterID, scannerID from events
- **Multi-Scanner User Lookup**: 
  ```javascript
  User.findOne({
    $or: [
      { 'enrollments.fingerprintId': fpId, 'enrollments.scannerID': scannerID },
      { fingerprintId: fpId } // Backward compatibility
    ]
  })
  ```
- **Security Alert Handling**: Blocks entry when `multiPersonDetected: true`
- **Access Rule Validation**: Checks user enrollment for specific cluster
- **Door Unlock Control**: Finds cluster's doorControlDevice and sends UNLOCK_DOOR command

**New Methods:**
- `handleSecurityAlert(event)`: Process multi-person detection from camera
- `checkAccessRules(user, clusterID, scannerID)`: Validate user access
- `unlockDoor(clusterID, userId, userName)`: Send unlock command to door controller
- `setSocketIo(io)`: Receive Socket.io instance for real-time updates

### 4. RabbitMQ Service Enhancements (`server/services/rabbitmq/rabbitMQService.js`)

**Event Routing:**
- `ATTENDANCE` → recognitionService.processAttendance()
- `DEVICE_REGISTER` → deviceRegistrationService.registerDevice()
- `HEARTBEAT` → deviceHealthService.processHeartbeat()
- `SECURITY_ALERT` → recognitionService.handleSecurityAlert()
- `ENROLL_SUCCESS` → handleEnrollmentSuccess()
- `ENROLL_UPDATE` → Forward to dashboard via Socket.io
- `ENROLL_FAILED` → Forward to dashboard via Socket.io

**Enrollment Handler:**
```javascript
async handleEnrollmentSuccess(event) {
  const { userId, fingerprintId, scannerID, deviceMAC, clusterID } = event;
  
  // Add to enrollments array
  await User.findByIdAndUpdate(userId, {
    $push: {
      enrollments: { scannerID, deviceMAC, fingerprintId, clusterID }
    },
    fingerprintId // Also update legacy field for first enrollment
  });
  
  // Emit real-time event
  io.emit('enrollment-success', { userId, scannerID });
}
```

## API Routes

### Device Management Routes (`server/routes/devices/deviceRoutes.js`)

**Cluster Endpoints:**
- `GET /api/devices/clusters` - List all clusters with device details
- `POST /api/devices/clusters` - Create new cluster
- `GET /api/devices/clusters/:clusterID` - Get specific cluster

**Device Endpoints:**
- `GET /api/devices` - List all devices (filterable by status, clusterID)
- `GET /api/devices/pending` - Get devices awaiting approval
- `GET /api/devices/scanners` - Get active scanners for enrollment
- `POST /api/devices/approve/:deviceMAC` - Approve and configure device
- `POST /api/devices/reject/:deviceMAC` - Reject pending device

**Health Endpoints:**
- `GET /api/devices/health/summary` - Aggregate health statistics
- `GET /api/devices/health/unhealthy` - Get offline/maintenance devices

**Control Endpoints:**
- `POST /api/devices/enroll` - Initiate enrollment on specific scanner
- `POST /api/devices/unlock/:clusterID` - Manual door unlock

## Dashboard Components

### 1. Device Management Page (`dashboard/src/pages/DeviceManagement.jsx`)

**Features:**
- **Health Summary Cards**: Total, active, offline, pending device counts
- **Cluster View**: 
  - List all clusters with operational status
  - Show devices within each cluster with live health metrics
  - Device role badges (ENTRY/EXIT)
  - Capability indicators (fingerprint, camera, relay)
  - Real-time heartbeat updates
- **Pending Approval Tab**: 
  - List devices awaiting admin approval
  - Approve/reject actions with configuration dialog
- **Manual Door Unlock**: Emergency unlock controls per cluster
- **Real-Time Updates**: Socket.io integration for live device status

**Socket Events:**
- Listens: `device-heartbeat`, `cluster-status-update`, `device-pending-approval`, `device-approved`, `devices-offline`

### 2. Enrollment Modal (`dashboard/src/components/EnrollmentModal.jsx`)

**Features:**
- **Scanner Selection**: Visual grid showing all active scanners
  - Scanner ID and location
  - Cluster assignment
  - Online/offline status
  - Device type badges
- **Two-Step Workflow**:
  1. Select scanner from available options
  2. Start enrollment and show progress
- **Real-Time Feedback**: 
  - Progress bar (33% → 66% → 100%)
  - Live status messages
  - Success/failure notifications

**Socket Events:**
- Listens: `enrollment-update`, `enrollment-success`, `enrollment-failed`

**Integration:**
Replace old enrollment buttons with:
```jsx
import EnrollmentModal from '@/components/EnrollmentModal';

const [enrollmentOpen, setEnrollmentOpen] = useState(false);

<EnrollmentModal
  open={enrollmentOpen}
  userId={user._id}
  username={user.username}
  onClose={() => setEnrollmentOpen(false)}
  onSuccess={() => fetchUsers()}
  socket={socket}
/>
```

## Message Protocols

### Complete Message Flow

#### 1. Device Registration
**ESP32 → Server:**
```json
{
  "eventType": "DEVICE_REGISTER",
  "deviceMAC": "AA:BB:CC:DD:EE:FF",
  "deviceType": "ESP32-CAM",
  "capabilities": ["fingerprint", "camera", "buzzer"],
  "payload": {
    "firmwareVersion": "1.0.0",
    "wifiSignal": -65
  }
}
```

**Server Response:** Creates Device with PENDING status, emits real-time event to dashboard.

#### 2. Device Heartbeat
**ESP32 → Server (every 60 seconds):**
```json
{
  "eventType": "HEARTBEAT",
  "deviceMAC": "AA:BB:CC:DD:EE:FF",
  "clusterID": "DOOR_01",
  "payload": {
    "uptime": 3600000,
    "wifiSignal": -68,
    "freeHeap": 180000,
    "fpSensorStatus": "OK",
    "cameraStatus": "OK",
    "doorLockState": "LOCKED"
  }
}
```

#### 3. Attendance Event
**ESP32 → Server:**
```json
{
  "eventType": "ATTENDANCE",
  "deviceMAC": "AA:BB:CC:DD:EE:FF",
  "scannerID": "SCANNER_01",
  "clusterID": "DOOR_01",
  "direction": "ENTRY",
  "payload": {
    "fingerprintId": 42,
    "confidence": 95,
    "multiPersonDetected": false,
    "doorLockState": "LOCKED"
  }
}
```

#### 4. Security Alert
**ESP32-CAM → Server (when camera detects multiple people):**
```json
{
  "eventType": "SECURITY_ALERT",
  "deviceMAC": "AA:BB:CC:DD:EE:FF",
  "clusterID": "DOOR_01",
  "payload": {
    "alertType": "MULTIPLE_PERSONS",
    "fingerprintId": 42,
    "personCount": 2,
    "description": "Multiple people detected during fingerprint scan"
  }
}
```

**Server Action:** Blocks entry, emits security alert to dashboard, does NOT unlock door.

#### 5. Door Unlock Command
**Server → ESP32 (after successful attendance validation):**
```json
{
  "action": "UNLOCK_DOOR",
  "targetDeviceMAC": "FF:EE:DD:CC:BB:AA",
  "clusterID": "DOOR_01",
  "duration": 5000,
  "userId": "605c72ef...",
  "userName": "John Doe",
  "reason": "Attendance verified",
  "timestamp": 1678910234000
}
```

**ESP32 Action:** Activate relay for `duration` milliseconds, then lock.

#### 6. Enrollment Command
**Server → ESP32 (when admin initiates enrollment):**
```json
{
  "action": "ENROLL",
  "id": 42,
  "userId": "605c72ef...",
  "targetDeviceMAC": "AA:BB:CC:DD:EE:FF",
  "scannerID": "SCANNER_01",
  "clusterID": "DOOR_01"
}
```

**ESP32 → Server (enrollment progress):**
```json
{
  "eventType": "ENROLL_UPDATE",
  "userId": "605c72ef...",
  "message": "Place finger on sensor",
  "step": 1
}
```

**ESP32 → Server (enrollment complete):**
```json
{
  "eventType": "ENROLL_SUCCESS",
  "userId": "605c72ef...",
  "fingerprintId": 42,
  "scannerID": "SCANNER_01",
  "deviceMAC": "AA:BB:CC:DD:EE:FF",
  "clusterID": "DOOR_01"
}
```

## Server Initialization

### Updated `server/index.js`

**Key Changes:**
```javascript
// Import new routes and services
import deviceRoutes from './routes/devices/deviceRoutes.js';
import deviceHealthService from './services/device/deviceHealthService.js';

// Register device routes
app.use('/api/devices', deviceRoutes);

// Pass Socket.io to services
rabbitMQService.setSocketIo(io);
deviceHealthService.setSocketIo(io);

// Start auto-offline detection (checks every 60 seconds)
deviceHealthService.startAutoOfflineDetection(60000);
```

## Installation & Setup

### 1. Install Dependencies
```powershell
cd server
npm install
```

### 2. Database Migration
Existing User records will work with backward compatibility. New enrollments will populate the `enrollments` array.

### 3. Start Server
```powershell
npm start
```

**Health Monitoring:** Auto-offline detection starts automatically, checking every 60 seconds.

### 4. Dashboard Setup
```powershell
cd dashboard
npm install
npm run dev
```

## Testing Workflow

### 1. Device Registration Flow
1. Power on ESP32 → Sends DEVICE_REGISTER
2. Check dashboard Device Management → See pending device
3. Click "Approve" → Assign cluster, role, scanner ID
4. Device becomes ACTIVE in cluster view

### 2. Enrollment Flow
1. Open Device Management → Verify scanner is online
2. Go to Student Management → Click "Enroll"
3. EnrollmentModal shows all active scanners
4. Select scanner → Click "Start Enrollment"
5. ESP32 receives ENROLL command → Guide user through fingerprint capture
6. ESP32 sends ENROLL_SUCCESS → Dashboard shows success, User.enrollments updated

### 3. Attendance Flow
1. User scans fingerprint on ENTRY device
2. ESP32 sends ATTENDANCE event with deviceMAC, scannerID, fingerprintId
3. Server recognitionService:
   - Looks up user by fingerprintId + scannerID
   - Checks if multiPersonDetected (camera)
   - If security alert → Block entry, emit alert
   - If valid → Create attendance record
4. Server finds cluster's doorControlDevice
5. Server sends UNLOCK_DOOR command to EXIT device relay
6. Door unlocks for 5 seconds

### 4. Health Monitoring
1. ESP32s send HEARTBEAT every 60 seconds
2. deviceHealthService updates Device.healthMetrics
3. Dashboard shows live WiFi signal, uptime, sensor status
4. If no heartbeat for 2 minutes → Auto-marked OFFLINE
5. Cluster status updates to DEGRADED or OFFLINE

## Security Considerations

### Multi-Person Detection
- ESP32-CAM captures image during fingerprint scan
- If multiple faces detected → `multiPersonDetected: true`
- Server blocks entry even if fingerprint valid
- Emits `security-alert` event to dashboard
- Door remains LOCKED

### Server-Side Door Control
- ESP32 never decides to unlock door
- Only server sends UNLOCK_DOOR after full validation:
  - User exists
  - Fingerprint matches enrolled scanners
  - No security alerts
  - User has access to this cluster

### Device Authentication
- MAC address-based identification
- Approval workflow prevents rogue devices
- Admin must explicitly approve and configure each device

## Future Enhancements

### Suggested Additions:
1. **Fingerprint ID Management**: Auto-increment per scanner to avoid collisions
2. **Device Firmware Updates**: OTA update commands via RabbitMQ
3. **Access Control Rules**: Time-based access, user groups, cluster restrictions
4. **Audit Logs**: Track all device approvals, manual unlocks, security alerts
5. **Dashboard Notifications**: Push alerts for offline devices, security events
6. **Multi-Tenancy**: Support for multiple organizations with isolated clusters
7. **Device Templates**: Pre-configure device settings for bulk deployment
8. **Health Thresholds**: Alert when WiFi signal weak, memory low, sensor errors

## Files Modified/Created

### Server
- ✅ `server/models/Device.js` (NEW)
- ✅ `server/models/Cluster.js` (NEW)
- ✅ `server/models/User.js` (UPDATED - added enrollments array)
- ✅ `server/services/device/deviceHealthService.js` (NEW)
- ✅ `server/services/device/deviceRegistrationService.js` (NEW)
- ✅ `server/services/pipelines/recognitionService.js` (UPDATED - cluster support)
- ✅ `server/services/rabbitmq/rabbitMQService.js` (UPDATED - new event handlers)
- ✅ `server/routes/devices/deviceRoutes.js` (NEW)
- ✅ `server/index.js` (UPDATED - registered routes, started health monitoring)

### Dashboard
- ✅ `dashboard/src/pages/DeviceManagement.jsx` (NEW)
- ✅ `dashboard/src/components/EnrollmentModal.jsx` (NEW)

### Documentation
- ✅ `ESP32_CONNECTION_GUIDE.md` (Complete hardware/software guide)
- ✅ `ESP32_SERVER_IMPLEMENTATION.md` (This file)

## Support

For issues or questions:
1. Check [ESP32_CONNECTION_GUIDE.md](./ESP32_CONNECTION_GUIDE.md) for ESP32 implementation details
2. Review message protocols in this document
3. Check browser console and server logs for Socket.io events
4. Verify RabbitMQ connection and queue setup

## License
MIT License - See project LICENSE file for details.
