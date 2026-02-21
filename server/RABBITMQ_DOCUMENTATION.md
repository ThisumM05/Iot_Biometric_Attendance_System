# RabbitMQ Communication Documentation

## 📋 Overview

This document details the RabbitMQ messaging infrastructure used in the IoT Biometric Attendance System for communication between the server and ESP32 devices.

---

## 🔌 Connection Details

### Configuration
- **Library**: `amqplib` v0.10.9
- **Connection URI**: `process.env.RABBITMQ_URI` or `amqp://localhost` (default)
- **Connection Method**: AMQP Protocol
- **Auto-Reconnect**: Enabled (5-second retry interval)
- **Persistent Messages**: Enabled (durable queues and persistent delivery)

### Connection Service
**Location**: [`services/rabbitmq/rabbitMQService.js`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/rabbitmq/rabbitMQService.js)

**Features**:
- Automatic reconnection on connection loss
- Channel error handling
- Socket.IO integration for real-time updates

---

## 📨 Queues

The system uses **2 primary queues**:

| Queue Name | Direction | Purpose | Durable |
|------------|-----------|---------|---------|
| `biometric_events` | Device → Server | Events from ESP32 devices (attendance, enrollments, alerts) | ✓ Yes |
| `biometric_commands` | Server → Device | Commands to ESP32 devices (enroll, unlock, sync) | ✓ Yes |

> **Note**: No topics/exchanges are currently used. The system uses direct queue-to-queue messaging.

---

## 📤 Messages Server SENDS (Commands Queue)

The server publishes commands to the `biometric_commands` queue that devices consume.

### 1. ENROLL (Legacy)
Initiates fingerprint enrollment on a device.

> [!WARNING]
> **Deprecated**: This legacy command does NOT include `targetDeviceMAC` field, so devices cannot filter it properly. Use `ENROLL_WITH_TEMPLATE` for new implementations.

**Schema**:
```json
{
  "action": "ENROLL",
  "id": 123,
  "userId": "507f1f77bcf86cd799439011",
  "deviceId": "DEVICE_001"
}
```

**Fields**:
- `action` (String): Command type - `"ENROLL"`
- `id` (Number): Fingerprint ID to assign
- `userId` (String): MongoDB User ID reference
- `deviceId` (String): Target device identifier (not MAC address)

**Known Issues**:
- Missing `targetDeviceMAC` - ESP32 requires this field for command filtering
- Missing `scannerID` - ESP32 validates this field before processing

**Source**: [`services/pipelines/registrationService.js:32-39`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/pipelines/registrationService.js#L32-L39)

---

### 2. ENROLL_WITH_TEMPLATE
Modern enrollment with template extraction and global sync support.

**Schema**:
```json
{
  "action": "ENROLL_WITH_TEMPLATE",
  "globalFingerprintId": 5,
  "userId": "507f1f77bcf86cd799439011",
  "targetDeviceMAC": "AA:BB:CC:DD:EE:FF",
  "scannerID": "SCANNER_01",
  "clusterID": "CLUSTER_A",
  "requestTemplate": true
}
```

**Fields**:
- `action` (String): `"ENROLL_WITH_TEMPLATE"`
- `globalFingerprintId` (Number): Global unique fingerprint ID
- `userId` (String): MongoDB User ID
- `targetDeviceMAC` (String): Target device MAC address
- `scannerID` (String): Scanner identifier
- `clusterID` (String): Cluster identifier
- `requestTemplate` (Boolean): Request device to return template data

**Source**: [`services/sync/templateSyncService.js:44-54`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/sync/templateSyncService.js#L44-L54)

---

### 3. INSTALL_TEMPLATE
Installs a fingerprint template on a device for global sync.

**Schema**:
```json
{
  "action": "INSTALL_TEMPLATE",
  "globalFingerprintId": 5,
  "localFingerprintId": 12,
  "userId": "507f1f77bcf86cd799439011",
  "templateData": "BASE64_ENCODED_TEMPLATE_DATA...",
  "templateMetadata": {
    "quality": 85,
    "size": 512,
    "format": "R308"
  },
  "targetDeviceMAC": "AA:BB:CC:DD:EE:FF",
  "scannerID": "SCANNER_02",
  "clusterID": "CLUSTER_A"
}
```

**Fields**:
- `action` (String): `"INSTALL_TEMPLATE"`
- `globalFingerprintId` (Number): Global fingerprint ID
- `localFingerprintId` (Number): Device-specific local ID
- `userId` (String): MongoDB User ID
- `templateData` (String): Base64-encoded fingerprint template
- `templateMetadata` (Object): Template quality and format info
- `targetDeviceMAC` (String): Target device MAC address
- `scannerID` (String): Scanner identifier
- `clusterID` (String): Cluster identifier

**Source**: [`services/sync/templateSyncService.js:194-206`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/sync/templateSyncService.js#L194-L206)

---

### 4. DELETE_TEMPLATE
Removes a fingerprint template from a device.

**Schema**:
```json
{
  "action": "DELETE_TEMPLATE",
  "globalFingerprintId": 5,
  "localFingerprintId": 12,
  "targetDeviceMAC": "AA:BB:CC:DD:EE:FF",
  "userId": "507f1f77bcf86cd799439011"
}
```

**Fields**:
- `action` (String): `"DELETE_TEMPLATE"`
- `globalFingerprintId` (Number): Global fingerprint ID
- `localFingerprintId` (Number): Device-specific local ID
- `targetDeviceMAC` (String): Target device MAC address
- `userId` (String): MongoDB User ID

**Source**: [`services/sync/templateSyncService.js:378-385`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/sync/templateSyncService.js#L378-L385)

---

### 5. CLEAR_ALL_TEMPLATES
Clears all fingerprint templates from a device.

**Schema**:
```json
{
  "action": "CLEAR_ALL_TEMPLATES",
  "targetDeviceMAC": "AA:BB:CC:DD:EE:FF",
  "scannerID": "SCANNER_01",
  "clusterID": "CLUSTER_A"
}
```

**Fields**:
- `action` (String): `"CLEAR_ALL_TEMPLATES"`
- `targetDeviceMAC` (String): Target device MAC address
- `scannerID` (String): Scanner identifier
- `clusterID` (String): Cluster identifier

**Source**: [`services/sync/templateSyncService.js:457-464`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/sync/templateSyncService.js#L457-L464)

---

### 6. UNLOCK_DOOR
Sends door unlock command to a device with relay capability.

**Schema**:
```json
{
  "action": "UNLOCK_DOOR",
  "targetDeviceMAC": "AA:BB:CC:DD:EE:FF",
  "clusterID": "CLUSTER_A",
  "duration": 5000,
  "reason": "ATTENDANCE_ENTRY",
  "userId": "507f1f77bcf86cd799439011",
  "username": "john_doe"
}
```

**Fields**:
- `action` (String): `"UNLOCK_DOOR"`
- `targetDeviceMAC` (String): Target device MAC address (must have relay capability)
- `clusterID` (String): Cluster identifier
- `duration` (Number): Unlock duration in milliseconds (ESP32 defaults to 5000 if not provided)
- `reason` (String): Reason for unlock
- `userId` (String): User ID who triggered the unlock
- `username` (String): Username for logging

**Source**: [`services/pipelines/recognitionService.js:318-328`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/pipelines/recognitionService.js#L318-L328)

---

## 📥 Messages Server EXPECTS (Events Queue)

The server consumes events from the `biometric_events` queue published by ESP32 devices.

### 1. ATTENDANCE
Fingerprint scan event for attendance tracking.

**Schema**:
```json
{
  "type": "ATTENDANCE",
  "eventType": "ATTENDANCE",
  "payload": {
    "fingerprintId": 123,
    "direction": "IN",
    "confidence": 195,
    "multiPersonDetected": false
  },
  "deviceMAC": "AA:BB:CC:DD:EE:FF",
  "clusterID": "CLUSTER_A",
  "scannerID": "SCANNER_01",
  "deviceRole": "ENTRY",
  "timestamp": 123456
}
```

**Fields**:
- `type` (String): `"ATTENDANCE"`
- `eventType` (String): `"ATTENDANCE"` (ESP32 includes both `type` and `eventType`)
- `payload.fingerprintId` (Number): Scanned fingerprint ID
- `payload.direction` (String): `"IN"` or `"OUT"` (derived from device role)
- `payload.confidence` (Number): Match confidence score (0-255, from ESP32 fingerprint sensor)
- `payload.multiPersonDetected` (Boolean): Security flag for multiple persons
- `deviceMAC` (String): Device MAC address
- `clusterID` (String): Cluster identifier
- `scannerID` (String): Scanner identifier
- `deviceRole` (String): Device role (`"ENTRY"`, `"EXIT"`, etc.)
- `timestamp` (Number): Milliseconds since ESP32 boot

**Handler**: [`services/pipelines/recognitionService.js:processAttendance()`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/pipelines/recognitionService.js#L17-L256)

**Processing**:
- Validates device status (must be ACTIVE)
- Checks for security alerts (multiPersonDetected)
- Looks up user by fingerprint ID (supports global sync and legacy formats)
- Validates user access to cluster
- Creates attendance log
- Updates daily attendance session
- Sends unlock command if authorized entry

---

### 2. DEVICE_REGISTER
Device registration/announcement event.

**Schema**:
```json
{
  "eventType": "DEVICE_REGISTER",
  "deviceMAC": "AA:BB:CC:DD:EE:FF",
  "payload": {
    "deviceType": "ESP32",
    "firmwareVersion": "1.0.0",
    "capabilities": ["fingerprint", "relay"]
  },
  "timestamp": 123456
}
```

**Fields**:
- `eventType` (String): `"DEVICE_REGISTER"` (ESP32 uses `eventType`, not `type`)
- `deviceMAC` (String): Device MAC address (at root level)
- `payload.deviceType` (String): Device hardware type
- `payload.firmwareVersion` (String): Firmware version
- `payload.capabilities` (Array): Device capabilities
- `timestamp` (Number): Milliseconds since ESP32 boot

**Handler**: [`services/device/deviceRegistrationService.js:registerDevice()`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/device/deviceRegistrationService.js#L20-L85)

**Processing**:
- Creates device with `PENDING` status (requires admin approval)
- Security: Ignores cluster/role info from device
- Emits `device-pending-approval` via Socket.IO

---

### 3. HEARTBEAT
Device health/status update.

**Schema**:
```json
{
  "type": "HEARTBEAT",
  "eventType": "HEARTBEAT",
  "deviceMAC": "AA:BB:CC:DD:EE:FF",
  "clusterID": "CLUSTER_A",
  "scannerID": "SCANNER_01",
  "payload": {
    "uptime": 86400000,
    "wifiSignal": -65,
    "freeHeap": 45000,
    "fpSensorStatus": "OK",
    "relayStatus": "OK",
    "doorLockState": "LOCKED",
    "lastScanTime": 123456,
    "mqttConnected": true
  },
  "timestamp": 123456
}
```

**Fields**:
- `type` (String): `"HEARTBEAT"`
- `eventType` (String): `"HEARTBEAT"`
- `deviceMAC` (String): Device MAC address
- `clusterID` (String): Cluster identifier (if approved)
- `scannerID` (String): Scanner identifier (if approved)
- `payload.uptime` (Number): Device uptime in **milliseconds** (not seconds)
- `payload.wifiSignal` (Number): WiFi RSSI signal strength (dBm)
- `payload.freeHeap` (Number): Free heap memory in bytes
- `payload.fpSensorStatus` (String): Fingerprint sensor status (`"OK"` or `"ERROR"`)
- `payload.relayStatus` (String): Relay status (`"OK"` or `"ERROR"`)
- `payload.doorLockState` (String): Current door state (`"LOCKED"` or `"UNLOCKED"`)
- `payload.lastScanTime` (Number): Last fingerprint scan timestamp (milliseconds)
- `payload.mqttConnected` (Boolean): MQTT connection status
- `timestamp` (Number): Milliseconds since ESP32 boot

**Handler**: [`services/device/deviceHealthService.js:processHeartbeat()`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/device/deviceHealthService.js)

---

### 4. SECURITY_ALERT
Security incident notification.

**Schema**:
```json
{
  "type": "SECURITY_ALERT",
  "payload": {
    "fingerprintId": 123,
    "multiPersonDetected": true,
    "personsDetected": 2
  },
  "deviceMAC": "AA:BB:CC:DD:EE:FF",
  "clusterID": "CLUSTER_A",
  "scannerID": "SCANNER_01"
}
```

**Fields**:
- `type` (String): `"SECURITY_ALERT"`
- `payload.fingerprintId` (Number): Associated fingerprint ID (if any)
- `payload.multiPersonDetected` (Boolean): Multiple persons flag
- `payload.personsDetected` (Number): Number of persons detected
- `deviceMAC` (String): Device MAC address
- `clusterID` (String): Cluster identifier
- `scannerID` (String): Scanner identifier

**Handler**: [`services/pipelines/recognitionService.js:handleSecurityAlert()`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/pipelines/recognitionService.js#L411-L447)

**Processing**:
- Logs security incident
- Emits `security-alert` via Socket.IO with severity level
- Blocks attendance processing

---

### 5. ENROLL_SUCCESS (Legacy)
Legacy enrollment completion confirmation.

**Schema**:
```json
{
  "type": "ENROLL_SUCCESS",
  "payload": {
    "fingerprintId": 123,
    "userId": "507f1f77bcf86cd799439011"
  },
  "deviceMAC": "AA:BB:CC:DD:EE:FF",
  "clusterID": "CLUSTER_A",
  "scannerID": "SCANNER_01"
}
```

**Fields**:
- `type` (String): `"ENROLL_SUCCESS"`
- `payload.fingerprintId` (Number): Assigned fingerprint ID
- `payload.userId` (String): MongoDB User ID
- `deviceMAC` (String): Device MAC address
- `clusterID` (String): Cluster identifier
- `scannerID` (String): Scanner identifier

**Handler**: [`services/rabbitmq/rabbitMQService.js:handleEnrollmentSuccess()`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/rabbitmq/rabbitMQService.js#L181-L234)

**Processing**:
- Updates user enrollment record
- Adds enrollment to user's enrollments array
- Sets `isEnrolled = true`
- Emits `enrollment-success` via Socket.IO

---

### 6. ENROLL_WITH_TEMPLATE_SUCCESS
Modern enrollment with template data.

**Schema**:
```json
{
  "type": "ENROLL_WITH_TEMPLATE_SUCCESS",
  "payload": {
    "userId": "507f1f77bcf86cd799439011",
    "globalFingerprintId": 5,
    "templateData": "BASE64_ENCODED_TEMPLATE...",
    "templateMetadata": {
      "quality": 85,
      "size": 512,
      "format": "R308"
    },
    "deviceMAC": "AA:BB:CC:DD:EE:FF",
    "scannerID": "SCANNER_01",
    "clusterID": "CLUSTER_A"
  }
}
```

**Fields**:
- `type` (String): `"ENROLL_WITH_TEMPLATE_SUCCESS"`
- `payload.userId` (String): MongoDB User ID
- `payload.globalFingerprintId` (Number): Global fingerprint ID
- `payload.templateData` (String): Base64-encoded fingerprint template
- `payload.templateMetadata` (Object): Template quality and format info
- `payload.deviceMAC` (String): Enrollment device MAC
- `payload.scannerID` (String): Scanner identifier
- `payload.clusterID` (String): Cluster identifier

**Handler**: [`services/rabbitmq/rabbitMQService.js:handleTemplateEnrollmentSuccess()`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/rabbitmq/rabbitMQService.js#L240-L248) → [`services/sync/templateSyncService.js:handleEnrollmentWithTemplate()`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/sync/templateSyncService.js#L75-L129)

**Processing**:
- Stores template data in database
- Marks user as enrolled
- Automatically syncs template to all other active devices
- Emits `enrollment-success` via Socket.IO

---

### 7. TEMPLATE_INSTALL_RESULT
Confirmation of template installation on device.

**Schema**:
```json
{
  "type": "TEMPLATE_INSTALL_RESULT",
  "payload": {
    "userId": "507f1f77bcf86cd799439011",
    "globalFingerprintId": 5,
    "localFingerprintId": 12,
    "deviceMAC": "AA:BB:CC:DD:EE:FF",
    "success": true,
    "error": null
  }
}
```

**Fields**:
- `type` (String): `"TEMPLATE_INSTALL_RESULT"`
- `payload.userId` (String): MongoDB User ID
- `payload.globalFingerprintId` (Number): Global fingerprint ID
- `payload.localFingerprintId` (Number): Device-specific local ID
- `payload.deviceMAC` (String): Device MAC address
- `payload.success` (Boolean): Installation success flag
- `payload.error` (String|null): Error message if failed

**Handler**: [`services/rabbitmq/rabbitMQService.js:handleTemplateInstallResult()`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/rabbitmq/rabbitMQService.js#L254-L272) → [`services/sync/templateSyncService.js:handleTemplateInstallResult()`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/sync/templateSyncService.js#L236-L272)

**Processing**:
- Updates sync status in user's `syncedDevices` array
- Sets status to `synced` or `failed`
- Emits `template-sync-update` via Socket.IO

---

### 8. TEMPLATE_DELETE_RESULT
Confirmation of template deletion from device.

**Schema**:
```json
{
  "type": "TEMPLATE_DELETE_RESULT",
  "payload": {
    "userId": "507f1f77bcf86cd799439011",
    "deviceMAC": "AA:BB:CC:DD:EE:FF",
    "globalFingerprintId": 5,
    "success": true
  }
}
```

**Fields**:
- `type` (String): `"TEMPLATE_DELETE_RESULT"`
- `payload.userId` (String): MongoDB User ID
- `payload.deviceMAC` (String): Device MAC address
- `payload.globalFingerprintId` (Number): Global fingerprint ID
- `payload.success` (Boolean): Deletion success flag

**Handler**: [`services/rabbitmq/rabbitMQService.js:handleTemplateDeleteResult()`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/rabbitmq/rabbitMQService.js#L278-L312)

**Processing**:
- Removes device from user's `syncedDevices` array
- Emits `template-delete-update` via Socket.IO

---

### 9. CLEAR_ALL_TEMPLATES_RESULT
Confirmation of clearing all templates from device.

**Schema**:
```json
{
  "type": "CLEAR_ALL_TEMPLATES_RESULT",
  "payload": {
    "deviceMAC": "AA:BB:CC:DD:EE:FF",
    "success": true,
    "clearedCount": 15
  }
}
```

**Fields**:
- `type` (String): `"CLEAR_ALL_TEMPLATES_RESULT"`
- `payload.deviceMAC` (String): Device MAC address
- `payload.success` (Boolean): Clear operation success flag
- `payload.clearedCount` (Number): Number of templates cleared

**Handler**: [`services/sync/templateSyncService.js:handleClearDeviceResult()`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/sync/templateSyncService.js#L485-L513)

**Processing**:
- Removes device from all users' `syncedDevices` arrays
- Logs cleared count

---

### 10. ENROLL_UPDATE
Enrollment progress update.

**Schema**:
```json
{
  "type": "ENROLL_UPDATE",
  "message": "Place finger on sensor...",
  "step": 1,
  "totalSteps": 3,
  "deviceId": "SCANNER_01"
}
```

**Fields**:
- `type` (String): `"ENROLL_UPDATE"`
- `message` (String): Progress message
- `step` (Number): Current step
- `totalSteps` (Number): Total steps
- `deviceId` (String): Device identifier

**Handler**: Forwarded directly via Socket.IO as `enrollment-update`

---

### 11. ENROLL_FAILED
Enrollment failure notification.

**Schema**:
```json
{
  "type": "ENROLL_FAILED",
  "payload": {
    "userId": "507f1f77bcf86cd799439011",
    "reason": "Timeout",
    "deviceId": "SCANNER_01"
  }
}
```

**Fields**:
- `type` (String): `"ENROLL_FAILED"`
- `payload.userId` (String): MongoDB User ID
- `payload.reason` (String): Failure reason
- `payload.deviceId` (String): Device identifier

**Handler**: Forwarded directly via Socket.IO as `enrollment-failed`

---

## 🔄 Message Flow Examples

### Example 1: User Enrollment (Global Sync)
```
1. Dashboard → Server API: POST /api/users/:userId/enroll
2. Server → RabbitMQ (Commands): ENROLL_WITH_TEMPLATE
3. Device → RabbitMQ (Events): ENROLL_UPDATE (step 1)
4. Device → RabbitMQ (Events): ENROLL_UPDATE (step 2)
5. Device → RabbitMQ (Events): ENROLL_UPDATE (step 3)
6. Device → RabbitMQ (Events): ENROLL_WITH_TEMPLATE_SUCCESS (with template data)
7. Server: Stores template, syncs to all devices
8. Server → RabbitMQ (Commands): INSTALL_TEMPLATE (to Device B)
9. Server → RabbitMQ (Commands): INSTALL_TEMPLATE (to Device C)
10. Device B → RabbitMQ (Events): TEMPLATE_INSTALL_RESULT
11. Device C → RabbitMQ (Events): TEMPLATE_INSTALL_RESULT
12. Server → Socket.IO: Real-time updates to dashboard
```

### Example 2: Attendance Entry
```
1. Device → RabbitMQ (Events): ATTENDANCE (fingerprintId=123, direction=IN)
2. Server: Validates device, looks up user, checks access
3. Server: Creates attendance log, updates daily session
4. Server → RabbitMQ (Commands): UNLOCK_DOOR (if authorized)
5. Server → Socket.IO: Real-time attendance update to dashboard
6. Device: Unlocks door relay
```

### Example 3: Device Registration
```
1. Device boots up
2. Device → RabbitMQ (Events): DEVICE_REGISTER
3. Server: Creates device with PENDING status
4. Server → Socket.IO: device-pending-approval
5. Admin → Server API: POST /api/devices/approve
6. Server: Updates device to ACTIVE, assigns to cluster
7. Server → Socket.IO: device-approved
8. Server: Auto-syncs all user templates to new device
```

---

## 🧪 Testing

### Simulator Script
**Location**: [`scripts/simulate-device.js`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/scripts/simulate-device.js)

**Usage**:
```bash
node scripts/simulate-device.js
```

**Features**:
- Simulates device connection to RabbitMQ
- Listens for commands on `biometric_commands`
- Allows manual attendance simulation by entering fingerprint IDs
- Simulates enrollment process with progress updates

---

## 🔐 Security Features

1. **Device Validation**: All attendance events validated against device status (must be ACTIVE)
2. **Admin Approval**: New devices require admin approval before activation
3. **Cluster Isolation**: Devices cannot self-assign to clusters
4. **Multi-Person Detection**: Security alerts block entry when multiple persons detected
5. **Persistent Messaging**: Messages survive server/device restarts (durable queues)

---

## 📊 Real-time Updates (Socket.IO)

The RabbitMQ service integrates with Socket.IO for real-time dashboard updates:

| Event | Trigger | Data |
|-------|---------|------|
| `enrollment-success` | ENROLL_SUCCESS received | Enrollment details |
| `enrollment-update` | ENROLL_UPDATE received | Progress info |
| `enrollment-failed` | ENROLL_FAILED received | Failure reason |
| `template-sync-update` | TEMPLATE_INSTALL_RESULT | Sync status |
| `template-delete-update` | TEMPLATE_DELETE_RESULT | Deletion status |
| `device-pending-approval` | DEVICE_REGISTER (new) | Device details |
| `device-approved` | Admin approval | Device config |
| `device-rejected` | Admin rejection | Device MAC |
| `security-alert` | SECURITY_ALERT received | Alert details |

---

## 📝 Notes

- **Message Acknowledgment**: Manual acknowledgment after successful processing
- **Error Handling**: Failed messages are acknowledged to prevent reprocessing
- **Reconnection**: Automatic 5-second retry on connection loss
- **Channel Recovery**: Channel errors trigger reconnection

---

## 🔗 Related Files

- [`services/rabbitmq/rabbitMQService.js`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/rabbitmq/rabbitMQService.js) - Main RabbitMQ service
- [`services/pipelines/recognitionService.js`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/pipelines/recognitionService.js) - Attendance processing
- [`services/pipelines/registrationService.js`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/pipelines/registrationService.js) - Legacy enrollment
- [`services/sync/templateSyncService.js`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/sync/templateSyncService.js) - Global template sync
- [`services/device/deviceRegistrationService.js`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/device/deviceRegistrationService.js) - Device management
- [`services/device/deviceHealthService.js`](file:///c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/services/device/deviceHealthService.js) - Device health monitoring

---

**Last Updated**: 2026-02-15
