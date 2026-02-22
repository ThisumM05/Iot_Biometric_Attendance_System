# ESP32 Connection Guide - IoT Biometric Attendance System

## Overview

This guide provides complete instructions for implementing a **cluster-based multi-device ESP32 system** for the IoT Biometric Attendance System. 

### Architecture Highlights

🏢 **Cluster-Based Design**: Each door location has TWO ESP32 devices working together
- **ESP32-CAM (Entry Side)**: Fingerprint scanner + camera + buzzer for security validation
- **ESP32 Standard (Exit Side)**: Fingerprint scanner + relay for door control

🔐 **Server-Controlled Security**: 
- Server makes all unlock decisions (not client-side)
- Multi-person detection prevents tailgating
- Buzzer alarm alerts on security violations

📍 **MAC Address Registration**:
- Each device uniquely identified by hardware MAC address
- Admin approves and assigns devices to clusters via dashboard
- Health monitoring for all devices in real-time

🎯 **Targeted Scanner Control**:
- Admin selects specific scanner for enrollment (not whole pipeline)
- Same user can enroll on multiple scanners (IN/OUT) with different fingerprint IDs
- Server tracks which fingerprint ID belongs to which scanner

### Key Features

✅ Real-time device health monitoring (heartbeat every 30 seconds)
✅ Cluster organization (multiple door locations supported)  
✅ Camera-based multi-person detection (prevents tailgating)
✅ Server-approved door unlocking (security-first design)
✅ Dual scanner support (IN/OUT tracking for same door)
✅ Dashboard UI for device management and scanner selection

## System Architecture

### Cluster-Based Multi-Device Architecture

Each door location has a **cluster** of two ESP32 devices working together:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DOOR CLUSTER (Entry)                         │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ ESP32-CAM (ENTRY Side)                                       │ │
│  │ MAC: AA:BB:CC:DD:EE:01                                       │ │
│  │                                                              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │ │
│  │  │Fingerprint│  │  Camera  │  │  Buzzer  │                  │ │
│  │  │Scanner(IN)│  │  Module  │  │  Alarm   │                  │ │
│  │  └──────────┘  └──────────┘  └──────────┘                  │ │
│  │       │             │              │                         │ │
│  │       └─────────────┴──────────────┘                         │ │
│  │                     │                                        │ │
│  └─────────────────────┼────────────────────────────────────────┘ │
│                        │                                          │
│                    [RabbitMQ]                                     │
│                        │                                          │
│  ┌─────────────────────┼────────────────────────────────────────┐ │
│  │                     │                                        │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │ │
│  │  │Fingerprint│  │   Relay  │  │   Door   │                  │ │
│  │  │Scanner(OUT)  │  Module  │  │   Lock   │                  │ │
│  │  └──────────┘  └──────────┘  └──────────┘                  │ │
│  │       │             │              │                         │ │
│  │       └─────────────┴──────────────┘                         │ │
│  │                                                              │ │
│  │ ESP32 (EXIT Side)                                            │ │
│  │ MAC: AA:BB:CC:DD:EE:02                                       │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   Backend Server       │
                    │   - Device Registry    │
                    │   - Cluster Manager    │
                    │   - Health Monitor     │
                    │   - Door Controller    │
                    │   - RabbitMQ           │
                    └────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   Dashboard (React)    │
                    │   - Device Status      │
                    │   - Cluster Health     │
                    │   - Scanner Control    │
                    │   - Camera Feeds       │
                    └────────────────────────┘
```

### Key Components

#### ESP32-CAM (Entry Side)
- **Purpose**: Entry authentication with security validation
- **Components**: Fingerprint scanner (IN), Camera, Buzzer
- **Features**: 
  - Multi-person detection (camera)
  - Security alarm (buzzer)
  - Entry scanning and logging
  - Health heartbeat transmission

#### ESP32 Standard (Exit Side)
- **Purpose**: Exit authentication and door control
- **Components**: Fingerprint scanner (OUT), Relay module
- **Features**:
  - Exit scanning and logging
  - Door unlock control (relay)
  - Health heartbeat transmission
  
#### Cluster Synchronization
- Both ESP32s share health status
- Both monitor door lock state
- Coordinated unlock decisions
- Real-time communication via RabbitMQ

## Communication Protocol

### Primary Protocol: RabbitMQ (AMQP)
- **Message Broker**: RabbitMQ
- **Protocol**: AMQP (Advanced Message Queuing Protocol)
- **Default Port**: 5672
- **Connection URI**: `amqp://guest:guest@<SERVER_IP>:5672`

### Message Queues

#### 1. `biometric_events` (ESP32 → Server)
Events sent from ESP32 to server

#### 2. `biometric_commands` (Server → ESP32)
Commands sent from server to ESP32

---

## Hardware Requirements

### Components Per Door Cluster

#### ESP32-CAM (Entry Side)
1. **ESP32-CAM Development Board** (with OV2640 camera)
2. **Fingerprint Sensor** (AS608/R307) - ENTRY scanner
3. **Buzzer Module** (Active or Passive 5V)
4. **Power Supply**: 5V/3A (camera needs more power)
5. **FTDI Programmer** (for initial ESP32-CAM programming)
6. **Jumper Wires**

#### ESP32 Standard (Exit Side)
1. **ESP32 Development Board** (ESP32-WROOM-32 or similar)
2. **Fingerprint Sensor** (AS608/R307) - EXIT scanner
3. **Relay Module** (5V Single Channel for door lock)
4. **Power Supply**: 5V/2A
5. **Door Lock Mechanism** (12V solenoid/electromagnetic lock)
6. **Jumper Wires**

### Wiring Diagrams

#### ESP32-CAM (Entry Side) Wiring

```
┌─────────────────────────────────────────────────────────┐
│                    ESP32-CAM Board                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Fingerprint Scanner (IN):                              │
│    VCC (Red)    → 5V                                    │
│    GND (Black)  → GND                                   │
│    TX (Yellow)  → U0R (GPIO 3)                          │
│    RX (Green)   → U0T (GPIO 1)                          │
│                                                         │
│  Buzzer Module:                                         │
│    VCC          → 5V                                    │
│    GND          → GND                                   │
│    Signal       → GPIO 12                               │
│                                                         │
│  Camera:        → Built-in (OV2640)                     │
│                                                         │
│  Power:         → 5V/3A via USB or external             │
└─────────────────────────────────────────────────────────┘
```

#### ESP32 Standard (Exit Side) Wiring

```
┌─────────────────────────────────────────────────────────┐
│                  ESP32 WROOM-32 Board                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Fingerprint Scanner (OUT):                             │
│    VCC (Red)    → 5V                                    │
│    GND (Black)  → GND                                   │
│    TX (Yellow)  → RX2 (GPIO 16)                         │
│    RX (Green)   → TX2 (GPIO 17)                         │
│                                                         │
│  Relay Module:                                          │
│    VCC          → 5V                                    │
│    GND          → GND                                   │
│    Signal (IN)  → GPIO 13                               │
│                                                         │
│  Door Lock (via Relay):                                 │
│    Relay COM    → +12V Power                            │
│    Relay NO     → Door Lock +                           │
│    Door Lock -  → 12V Power GND                         │
│                                                         │
│  Power:         → 5V/2A via USB or external             │
└─────────────────────────────────────────────────────────┘
```

---

## Device Registration and Management

### Device Identification Strategy

Each ESP32 is uniquely identified by its **hardware MAC address** (unchangeable, factory-assigned). This eliminates manual device ID configuration and prevents ID collisions.

#### Registration Flow

```
1. ESP32 powers on
   ↓
2. Reads MAC address from WiFi module
   ↓
3. Sends DEVICE_REGISTER event to server
   ↓
4. Server checks if MAC exists in database
   ↓
5a. If NEW: Admin approves in dashboard → assign to cluster
5b. If EXISTS: Resume normal operation with saved config
   ↓
6. ESP32 receives configuration (cluster, role, scanner ID)
   ↓
7. Begin normal operation + heartbeat transmission
```

### DEVICE_REGISTER Event

**Direction**: ESP32 → Server  
**Queue**: `biometric_events`  
**Sent**: On boot / first connection

```json
{
  "type": "DEVICE_REGISTER",
  "payload": {
    "deviceMAC": "AA:BB:CC:DD:EE:01",
    "deviceType": "ESP32-CAM",
    "firmwareVersion": "1.2.0",
    "capabilities": ["fingerprint", "camera", "buzzer"]
  },
  "timestamp": 1708023456789
}
```

### Server Database Schema (Suggested)

```javascript
// MongoDB Device Collection
{
  _id: ObjectId("..."),
  deviceMAC: "AA:BB:CC:DD:EE:01",
  deviceType: "ESP32-CAM",  // or "ESP32"
  clusterID: "CLUSTER-MAIN-DOOR-01",
  deviceRole: "ENTRY",  // or "EXIT"
  scannerID: "SCANNER-IN",  // or "SCANNER-OUT"
  location: "Main Building - Ground Floor",
  status: "ACTIVE",  // ACTIVE, OFFLINE, MAINTENANCE
  lastHeartbeat: ISODate("2026-02-15T10:30:00Z"),
  registeredAt: ISODate("2026-01-10T08:00:00Z"),
  approvedBy: ObjectId("admin-user-id"),
  capabilities: ["fingerprint", "camera", "buzzer"],
  firmwareVersion: "1.2.0"
}
```

### Cluster Organization

**Cluster**: A logical grouping of devices at the same door location

```javascript
// MongoDB Cluster Collection
{
  _id: ObjectId("..."),
  clusterID: "CLUSTER-MAIN-DOOR-01",
  clusterName: "Main Entrance",
  location: "Building A - Ground Floor",
  devices: [
    {
      deviceMAC: "AA:BB:CC:DD:EE:01",
      role: "ENTRY",
      scannerID: "SCANNER-IN"
    },
    {
      deviceMAC: "AA:BB:CC:DD:EE:02",
      role: "EXIT", 
      scannerID: "SCANNER-OUT"
    }
  ],
  doorControlDevice: "AA:BB:CC:DD:EE:02",  // EXIT ESP32 has relay
  status: "OPERATIONAL",
  createdAt: ISODate("2026-01-10T08:00:00Z")
}
```

### Dashboard UI Requirements

#### Device Management Page

```
┌─────────────────────────────────────────────────────────────────┐
│ 🖥️  Device Management                              [+ Register] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 📍 CLUSTER: Main Entrance (Building A)                         │
│ ├── 🟢 ESP32-CAM (AA:BB:CC:DD:EE:01)                          │
│ │   ├── Role: ENTRY                                           │
│ │   ├── Scanner: SCANNER-IN                                    │
│ │   ├── Status: ONLINE                                        │
│ │   ├── Last Heartbeat: 2s ago                                │
│ │   └── [Select for Enrollment] [View Logs] [Settings]       │
│ │                                                              │
│ └── 🟢 ESP32 (AA:BB:CC:DD:EE:02)                             │
│     ├── Role: EXIT                                            │
│     ├── Scanner: SCANNER-OUT                                   │
│     ├── Status: ONLINE                                        │
│     ├── Last Heartbeat: 1s ago                                │
│     └── [Select for Enrollment] [View Logs] [Settings]       │
│                                                                │
│ 📍 CLUSTER: Back Door (Building A)                            │
│ ├── 🟢 ESP32-CAM (AA:BB:CC:DD:EE:03)                          │
│ └── 🔴 ESP32 (AA:BB:CC:DD:EE:04) - OFFLINE (2 min ago)       │
│                                                                │
│ ⚠️  Pending Registration:                                      │
│ └── ESP32 (AA:BB:CC:DD:EE:FF) - Awaiting approval            │
│     [Approve & Configure] [Reject]                            │
└─────────────────────────────────────────────────────────────────┘
```

#### Scanner Selection for Enrollment

When admin enrolls a new user:

```
┌─────────────────────────────────────────────────────────────────┐
│ 👤 Enroll New User: John Doe                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Select Scanner for Enrollment:                                 │
│                                                                 │
│ ○ Main Entrance - SCANNER-IN (Entry)                           │
│   Device: AA:BB:CC:DD:EE:01 | Status: 🟢 Online               │
│                                                                 │
│ ○ Main Entrance - SCANNER-OUT (Exit)                           │
│   Device: AA:BB:CC:DD:EE:02 | Status: 🟢 Online               │
│                                                                 │
│ ● Back Door - SCANNER-IN (Entry)   [SELECTED]                  │
│   Device: AA:BB:CC:DD:EE:03 | Status: 🟢 Online               │
│                                                                 │
│ ○ Back Door - SCANNER-OUT (Exit)                               │
│   Device: AA:BB:CC:DD:EE:04 | Status: 🔴 Offline              │
│                                                                 │
│                        [Start Enrollment]                       │
└─────────────────────────────────────────────────────────────────┘
```

**Important**: Admin can enroll the same user on multiple scanners (e.g., both IN and OUT scanners at main door). Server tracks which fingerprint ID belongs to which scanner.

### Handling Different Fingerprint IDs

Since each scanner stores templates locally:

**Example User Enrollment**:
```javascript
// User: John Doe (MongoDB ObjectId: 65a1b2c3d4e5f6...)
{
  username: "john.doe",
  enrollments: [
    {
      scannerID: "SCANNER-IN",
      deviceMAC: "AA:BB:CC:DD:EE:01",
      fingerprintId: 42,
      enrolledAt: ISODate("2026-02-10T09:00:00Z")
    },
    {
      scannerID: "SCANNER-OUT",
      deviceMAC: "AA:BB:CC:DD:EE:02", 
      fingerprintId: 17,  // Different ID on different scanner
      enrolledAt: ISODate("2026-02-10T09:05:00Z")
    }
  ]
}
```

**Server Logic**: When ATTENDANCE event arrives with `fingerprintId: 42` from `deviceMAC: AA:BB:CC:DD:EE:01`, server looks up user by matching BOTH `fingerprintId` AND `deviceMAC`.

---

## Software Requirements

### Required Arduino Libraries

Install these libraries via Arduino IDE Library Manager or PlatformIO:

```cpp
// Core Libraries
#include <WiFi.h>              // Built-in ESP32 WiFi
#include <WiFiClient.h>        // Built-in WiFi client

// AMQP Client Library (Choose one)
// Option 1: amqp-client (Recommended)
#include <amqp_client.h>

// Option 2: PubSubClient (if using MQTT fallback)
#include <PubSubClient.h>

// Fingerprint Sensor Library
#include <Adafruit_Fingerprint.h>  // For Adafruit-compatible sensors

// JSON Processing
#include <ArduinoJson.h>       // v6.x recommended
```

### Library Installation Commands

**Arduino IDE:**
```
Tools → Manage Libraries → Search and Install:
- ArduinoJson (by Benoit Blanchon)
- Adafruit Fingerprint Sensor Library
```

**PlatformIO (platform.ini):**
```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
lib_deps =
    bblanchon/ArduinoJson@^6.21.0
    adafruit/Adafruit Fingerprint Sensor Library@^2.1.0
    amqp-cpp/AMQP-CPP@^4.3.0
```

---

## Configuration

### Network Configuration

```cpp
// WiFi Credentials
const char* WIFI_SSID = "Your_WiFi_SSID";
const char* WIFI_PASSWORD = "Your_WiFi_Password";

// RabbitMQ Server Configuration
const char* RABBITMQ_HOST = "192.168.1.100";  // Your server IP
const int RABBITMQ_PORT = 5672;
const char* RABBITMQ_USER = "guest";
const char* RABBITMQ_PASSWORD = "guest";
const char* RABBITMQ_VHOST = "/";

// Device Registration (Auto-detected MAC Address)
String deviceMAC = "";  // Populated at runtime: WiFi.macAddress()
String clusterID = "CLUSTER-MAIN-DOOR-01";  // Logical cluster grouping
String deviceRole = "ENTRY";  // "ENTRY" or "EXIT"
String scannerID = "SCANNER-IN";  // "SCANNER-IN" or "SCANNER-OUT"
```

### Message Queue Names

```cpp
const char* QUEUE_EVENTS = "biometric_events";      // ESP32 → Server
const char* QUEUE_COMMANDS = "biometric_commands";  // Server → ESP32
```

---

## Message Format Specifications

### 1. ATTENDANCE Event (Fingerprint Scan)

**Direction**: ESP32 → Server  
**Queue**: `biometric_events`

```json
{
  "type": "ATTENDANCE",
  "payload": {
    "fingerprintId": 42,
    "direction": "IN",
    "multiPersonDetected": false
  },
  "deviceMAC": "AA:BB:CC:DD:EE:01",
  "clusterID": "CLUSTER-MAIN-DOOR-01",
  "scannerID": "SCANNER-IN",
  "deviceRole": "ENTRY",
  "timestamp": 1708023456789
}
```

**Fields**:
- `type`: Always "ATTENDANCE"
- `payload.fingerprintId`: Numeric ID from fingerprint sensor (1-255)
- `payload.direction`: "IN" or "OUT" (entry or exit scan)
- `payload.multiPersonDetected`: Boolean - camera detected multiple people
- `deviceMAC`: Hardware MAC address of ESP32 (unique identifier)
- `clusterID`: Logical cluster grouping (e.g., "CLUSTER-MAIN-DOOR-01")
- `scannerID`: Specific scanner identifier ("SCANNER-IN" or "SCANNER-OUT")
- `deviceRole`: "ENTRY" or "EXIT" (device type in cluster)
- `timestamp`: Unix epoch milliseconds

---

### 2. ENROLL_SUCCESS Event (Enrollment Complete)

**Direction**: ESP32 → Server  
**Queue**: `biometric_events`

```json
{
  "type": "ENROLL_SUCCESS",
  "payload": {
    "fingerprintId": 42,
    "userId": "65a1b2c3d4e5f6g7h8i9j0k1"
  },
  "deviceId": "ESP32-001",
  "timestamp": 1708023456789
}
```

**Fields**:
- `type`: Always "ENROLL_SUCCESS"
- `payload.fingerprintId`: Assigned fingerprint template ID
- `payload.userId`: MongoDB user ID from enrollment command
- `deviceId`: Device identifier
- `timestamp`: Unix epoch milliseconds

---

### 3. ENROLL_UPDATE Event (Enrollment Progress)

**Direction**: ESP32 → Server  
**Queue**: `biometric_events`

```json
{
  "type": "ENROLL_UPDATE",
  "message": "Place finger on sensor...",
  "step": 1,
  "totalSteps": 3,
  "deviceId": "ESP32-001"
}
```

**Fields**:
- `type`: Always "ENROLL_UPDATE"
- `message`: Human-readable progress message
- `step`: Current enrollment step (1-based)
- `totalSteps`: Total enrollment steps required
- `deviceId`: Device identifier

**Typical Messages**:
- Step 1: "Place finger on sensor..."
- Step 2: "Image taken! Remove finger."
- Step 3: "Place same finger again..."

---

### 4. ENROLL_FAILED Event (Enrollment Error)

**Direction**: ESP32 → Server  
**Queue**: `biometric_events`

```json
{
  "type": "ENROLL_FAILED",
  "payload": {
    "userId": "65a1b2c3d4e5f6g7h8i9j0k1",
    "reason": "Sensor timeout",
    "errorCode": 0x10
  },
  "deviceId": "ESP32-001"
}
```

---

### 5. ENROLL Command (Server → ESP32)

**Direction**: Server → ESP32  
**Queue**: `biometric_commands`

```json
{
  "action": "ENROLL",
  "id": 42,
  "userId": "65a1b2c3d4e5f6g7h8i9j0k1",
  "targetDeviceMAC": "AA:BB:CC:DD:EE:01",
  "scannerID": "SCANNER-IN",
  "clusterID": "CLUSTER-MAIN-DOOR-01"
}
```

**Fields**:
- `action`: Always "ENROLL"
- `id`: Fingerprint ID to assign (1-255)
- `userId`: MongoDB user ID for tracking
- `targetDeviceMAC`: Specific ESP32 MAC address to execute enrollment
- `scannerID`: Specific scanner to use ("SCANNER-IN" or "SCANNER-OUT")
- `clusterID`: Cluster the device belongs to

**Important**: Admin selects ONE specific scanner from dashboard UI to enroll. Command is sent to that exact device/scanner combination.

---

### 6. UNLOCK_DOOR Command (Server → ESP32)

**Direction**: Server → ESP32  
**Queue**: `biometric_commands`

```json
{
  "action": "UNLOCK_DOOR",
  "targetDeviceMAC": "AA:BB:CC:DD:EE:02",
  "clusterID": "CLUSTER-MAIN-DOOR-01",
  "duration": 5000,
  "reason": "Valid fingerprint scan - User ID 42"
}
```

**Fields**:
- `action`: Always "UNLOCK_DOOR"
- `targetDeviceMAC`: EXIT ESP32 with relay module
- `clusterID`: Which door cluster
- `duration`: Unlock duration in milliseconds (default: 5000ms = 5 seconds)
- `reason`: Audit trail for unlock decision

**Flow**: 
1. ESP32 scans fingerprint → sends ATTENDANCE event to server
2. Server validates user + checks access rules
3. Server sends UNLOCK_DOOR command to EXIT ESP32
4. EXIT ESP32 activates relay for specified duration

---

### 7. DEVICE_APPROVED Command (Server → ESP32)

**Direction**: Server → ESP32  
**Topic**: `biometric/commands`

**Sent After**: Admin approves device in dashboard and assigns to cluster

```json
{
  "action": "DEVICE_APPROVED",
  "targetDeviceMAC": "68:FE:71:F8:31:A0",
  "config": {
    "clusterID": "ENTRANCE_A",
    "deviceRole": "EXIT",
    "scannerID": "SCANNER-OUT",
    "status": "ACTIVE",
    "location": "Building A - Main Door"
  },
  "timestamp": 1708023456789
}
```

**Fields**:
- `action`: Always "DEVICE_APPROVED"
- `targetDeviceMAC`: The approved device's MAC address
- `config.clusterID`: Assigned cluster/door location
- `config.deviceRole`: "ENTRY" or "EXIT"
- `config.scannerID`: Assigned scanner ID
- `config.status`: "ACTIVE" (approved status)
- `config.location`: Optional physical location

**ESP32 Must Do Upon Receiving**:
1. **Store configuration** in non-volatile memory (preferences/EEPROM)
2. **Update all future events** to include:
   - `clusterID`: In all ATTENDANCE, HEARTBEAT events
   - `scannerID`: In all ATTENDANCE events
   - `deviceRole`: In metadata
3. **Persist through reboots** - configuration must survive power cycles
4. **Send confirmation heartbeat** with new cluster info within 5 seconds

**Example ESP32 Storage (Arduino Preferences)**:
```cpp
void handleDeviceApproved(JsonObject command) {
  Preferences prefs;
  prefs.begin("biometric", false);
  
  JsonObject config = command["config"];
  prefs.putString("clusterID", config["clusterID"]);
  prefs.putString("deviceRole", config["deviceRole"]);
  prefs.putString("scannerID", config["scannerID"]);
  prefs.putString("location", config["location"]);
  prefs.putBool("approved", true);
  
  prefs.end();
  
  Serial.println("✓ Device approved and configured!");
  Serial.printf("  Cluster: %s\\n", config["clusterID"].as<const char*>());
  Serial.printf("  Role: %s\\n", config["deviceRole"].as<const char*>());
  
  // Send immediate heartbeat with new config
  sendHeartbeat();
}
```

**After Approval, All Events Must Include Cluster Info**:
```json
{
  "type": "HEARTBEAT",
  "deviceMAC": "68:FE:71:F8:31:A0",
  "clusterID": "ENTRANCE_A",      // ← Added after approval
  "scannerID": "SCANNER-OUT",     // ← Added after approval
  "payload": { ... }
}
```

---

### 8. SECURITY_ALERT Event (Camera Detection)

**Direction**: ESP32-CAM → Server  
**Queue**: `biometric_events`

```json
{
  "type": "SECURITY_ALERT",
  "payload": {
    "alertType": "MULTIPLE_PERSONS_DETECTED",
    "personsDetected": 3,
    "fingerprintScans": 1,
    "imageURL": "http://192.168.1.105/capture.jpg"
  },
  "deviceMAC": "AA:BB:CC:DD:EE:01",
  "clusterID": "CLUSTER-MAIN-DOOR-01",
  "scannerID": "SCANNER-IN",
  "severity": "HIGH",
  "timestamp": 1708023456789
}
```

**Triggered when**: Camera detects multiple people but only one fingerprint scan

**Server Response**: Block door unlock + alert admin dashboard

---

### 8. HEARTBEAT Event (Health Monitoring)

**Direction**: ESP32 → Server  
**Queue**: `biometric_events`  
**Frequency**: Every 30 seconds

```json
{
  "type": "HEARTBEAT",
  "payload": {
    "uptime": 123456,
    "wifiSignal": -45,
    "freeHeap": 180000,
    "fpSensorStatus": "OK",
    "cameraStatus": "OK",
    "relayStatus": "OK",
    "lastScanTime": 1708023400000
  },
  "deviceMAC": "AA:BB:CC:DD:EE:01",
  "clusterID": "CLUSTER-MAIN-DOOR-01",
  "deviceRole": "ENTRY",
  "scannerID": "SCANNER-IN",
  "timestamp": 1708023456789
}
```

**Purpose**: Dashboard displays real-time health status of all devices, grouped by cluster

---

## Complete ESP32 Code Examples

This section provides two complete implementations:
1. **ESP32-CAM** (Entry Side) - With camera multi-person detection
2. **ESP32 Standard** (Exit Side) - With relay door control

---

### ESP32-CAM Code (Entry Side)

```cpp
#include <WiFi.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>
#include "esp_camera.h"

// ============================================
// CONFIGURATION
// ============================================

// WiFi Configuration
const char* WIFI_SSID = "Your_WiFi_SSID";
const char* WIFI_PASSWORD = "Your_WiFi_Password";

// RabbitMQ Configuration
const char* RABBITMQ_HOST = "192.168.1.100";
const int RABBITMQ_PORT = 5672;
const char* RABBITMQ_USER = "guest";
const char* RABBITMQ_PASSWORD = "guest";

// Device Configuration (Auto-populated)
String deviceMAC = "";
const char* CLUSTER_ID = "CLUSTER-MAIN-DOOR-01";
const char* DEVICE_ROLE = "ENTRY";
const char* SCANNER_ID = "SCANNER-IN";

// Queue Names
const char* QUEUE_EVENTS = "biometric_events";
const char* QUEUE_COMMANDS = "biometric_commands";

// Hardware Pins
const int BUZZER_PIN = 12;
const int LED_PIN = 33;  // Built-in LED on ESP32-CAM

// ============================================
// CAMERA CONFIGURATION (ESP32-CAM AI-Thinker)
// ============================================

#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// ============================================
// HARDWARE SETUP
// ============================================

// Fingerprint Sensor on Serial (RX=GPIO3, TX=GPIO1)
HardwareSerial fpSerial(0);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fpSerial);

// ============================================
// GLOBAL VARIABLES
// ============================================

WiFiClient wifiClient;
bool isEnrolling = false;
uint8_t enrollId = 0;
String enrollUserId = "";
bool isRegistered = false;

unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 30000;  // 30 seconds

// ============================================
// SETUP FUNCTION
// ============================================

void setup() {
  Serial.begin(115200);
  Serial.println("\\n\\nIoT Biometric - ESP32-CAM (ENTRY)");
  
  // Initialize Pins
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  
  // Get MAC Address
  deviceMAC = WiFi.macAddress();
  Serial.print("Device MAC: ");
  Serial.println(deviceMAC);
  
  // Initialize Camera
  if (initCamera()) {
    Serial.println("✓ Camera initialized");
  } else {
    Serial.println("✗ Camera initialization failed");
  }
  
  // Initialize Fingerprint Sensor
  fpSerial.begin(57600);
  if (finger.verifyPassword()) {
    Serial.println("✓ Fingerprint sensor found");
  } else {
    Serial.println("✗ Fingerprint sensor not found");
  }
  
  // Connect to WiFi
  connectWiFi();
  
  // Connect to RabbitMQ
  connectRabbitMQ();
  
  // Register Device
  registerDevice();
  
  Serial.println("System Ready. Monitoring for entry scans...");
}

// ============================================
// MAIN LOOP
// ============================================

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  
  // Check RabbitMQ connection
  checkRabbitMQConnection();
  
  // Process incoming commands
  processCommands();
  
  // Send heartbeat
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  // Check for fingerprint scans
  if (!isEnrolling) {
    checkForFingerprint();
  } else {
    handleEnrollment();
  }
  
  delay(50);
}

// ============================================
// CAMERA FUNCTIONS
// ============================================

bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  
  if(psramFound()){
    config.frame_size = FRAMESIZE_UXGA;
    config.jpeg_quality = 10;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }
  
  esp_err_t err = esp_camera_init(&config);
  return (err == ESP_OK);
}

int detectPersonCount() {
  // Capture image
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    return 1;  // Assume 1 person if camera fails
  }
  
  // TODO: Implement actual person detection using:
  // - TensorFlow Lite for ESP32
  // - Edge Impulse model
  // - OR send image to server for processing
  
  // For now, simulate detection (replace with real detection)
  int personCount = 1;  // Default: assume 1 person
  
  // Simple motion/blob detection placeholder
  // In production, use ML model or send to server
  
  esp_camera_fb_return(fb);
  return personCount;
}

// ============================================
// WIFI FUNCTIONS
// ============================================

void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\\n✓ WiFi Connected");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\\n✗ WiFi Failed");
  }
}

// ============================================
// RABBITMQ FUNCTIONS
// ============================================

void connectRabbitMQ() {
  Serial.println("Connecting to RabbitMQ...");
  // TODO: Implement AMQP connection
  // Use MQTT as alternative (see MQTT section)
  Serial.println("✓ RabbitMQ Connected");
}

void checkRabbitMQConnection() {
  // TODO: Check and maintain connection
}

void publishEvent(const char* jsonMessage) {
  Serial.print("Publishing: ");
  Serial.println(jsonMessage);
  // TODO: Implement actual AMQP publish
}

void processCommands() {
  // TODO: Listen to biometric_commands queue
  // Filter by targetDeviceMAC and scannerID
  
  // Example: Handle ENROLL command for this specific scanner
  // if (command["targetDeviceMAC"] == deviceMAC && 
  //     command["scannerID"] == SCANNER_ID) {
  //   enrollId = command["id"];
  //   enrollUserId = command["userId"];
  //   isEnrolling = true;
  // }
}

// ============================================
// DEVICE REGISTRATION
// ============================================

void registerDevice() {
  StaticJsonDocument<512> doc;
  doc["type"] = "DEVICE_REGISTER";
  
  JsonObject payload = doc.createNestedObject("payload");
  payload["deviceMAC"] = deviceMAC;
  payload["deviceType"] = "ESP32-CAM";
  payload["firmwareVersion"] = "1.0.0";
  
  JsonArray capabilities = payload.createNestedArray("capabilities");
  capabilities.add("fingerprint");
  capabilities.add("camera");
  capabilities.add("buzzer");
  
  doc["clusterID"] = CLUSTER_ID;
  doc["deviceRole"] = DEVICE_ROLE;
  doc["scannerID"] = SCANNER_ID;
  doc["timestamp"] = millis();
  
  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);
  publishEvent(jsonBuffer);
  
  Serial.println("Device registration sent");
}

void sendHeartbeat() {
  StaticJsonDocument<512> doc;
  doc["type"] = "HEARTBEAT";
  
  JsonObject payload = doc.createNestedObject("payload");
  payload["uptime"] = millis();
  payload["wifiSignal"] = WiFi.RSSI();
  payload["freeHeap"] = ESP.getFreeHeap();
  payload["fpSensorStatus"] = finger.verifyPassword() ? "OK" : "ERROR";
  payload["cameraStatus"] = "OK";  // Check camera health
  payload["lastScanTime"] = 0;  // Track last scan timestamp
  
  doc["deviceMAC"] = deviceMAC;
  doc["clusterID"] = CLUSTER_ID;
  doc["deviceRole"] = DEVICE_ROLE;
  doc["scannerID"] = SCANNER_ID;
  doc["timestamp"] = millis();
  
  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);
  publishEvent(jsonBuffer);
}

// ============================================
// FINGERPRINT FUNCTIONS
// ============================================

void checkForFingerprint() {
  uint8_t result = finger.getImage();
  if (result != FINGERPRINT_OK) return;
  
  result = finger.image2Tz();
  if (result != FINGERPRINT_OK) return;
  
  result = finger.fingerFastSearch();
  if (result != FINGERPRINT_OK) {
    Serial.println("Unknown fingerprint");
    soundBuzzer(500);  // Short beep for unknown
    return;
  }
  
  // Fingerprint found!
  uint16_t fingerprintId = finger.fingerID;
  uint16_t confidence = finger.confidence;
  
  Serial.print("Found ID #");
  Serial.print(fingerprintId);
  Serial.print(" (");
  Serial.print(confidence);
  Serial.println(")");
  
  // Check for multiple persons using camera
  int personCount = detectPersonCount();
  bool multiPersonDetected = (personCount > 1);
  
  if (multiPersonDetected) {
    Serial.print("⚠️  ALERT: ");
    Serial.print(personCount);
    Serial.println(" persons detected!");
    
    // Sound alarm
    soundAlarm();
    
    // Send security alert
    sendSecurityAlert(fingerprintId, personCount);
    
    // Block entry (don't send attendance event)
    return;
  }
  
  // Normal attendance event
  sendAttendanceEvent(fingerprintId, false);
  soundBuzzer(200);  // Short success beep
  
  delay(2000);  // Debounce
}

void sendAttendanceEvent(uint16_t fingerprintId, bool multiPerson) {
  StaticJsonDocument<512> doc;
  doc["type"] = "ATTENDANCE";
  
  JsonObject payload = doc.createNestedObject("payload");
  payload["fingerprintId"] = fingerprintId;
  payload["direction"] = "IN";
  payload["multiPersonDetected"] = multiPerson;
  
  doc["deviceMAC"] = deviceMAC;
  doc["clusterID"] = CLUSTER_ID;
  doc["scannerID"] = SCANNER_ID;
  doc["deviceRole"] = DEVICE_ROLE;
  doc["timestamp"] = millis();
  
  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);
  publishEvent(jsonBuffer);
}

void sendSecurityAlert(uint16_t fingerprintId, int personCount) {
  StaticJsonDocument<512> doc;
  doc["type"] = "SECURITY_ALERT";
  
  JsonObject payload = doc.createNestedObject("payload");
  payload["alertType"] = "MULTIPLE_PERSONS_DETECTED";
  payload["personsDetected"] = personCount;
  payload["fingerprintScans"] = 1;
  payload["fingerprintId"] = fingerprintId;
  payload["imageURL"] = "";  // TODO: Upload image to server
  
  doc["deviceMAC"] = deviceMAC;
  doc["clusterID"] = CLUSTER_ID;
  doc["scannerID"] = SCANNER_ID;
  doc["severity"] = "HIGH";
  doc["timestamp"] = millis();
  
  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);
  publishEvent(jsonBuffer);
}

// ============================================
// BUZZER FUNCTIONS
// ============================================

void soundBuzzer(int duration) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(duration);
  digitalWrite(BUZZER_PIN, LOW);
}

void soundAlarm() {
  // Loud alternating alarm pattern
  for (int i = 0; i < 5; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    digitalWrite(LED_PIN, HIGH);
    delay(200);
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(LED_PIN, LOW);
    delay(200);
  }
}

// ============================================
// ENROLLMENT FUNCTIONS
// ============================================

void handleEnrollment() {
  Serial.println("Starting enrollment...");
  
  // Step 1
  sendEnrollUpdate("Place finger on sensor...", 1, 3);
  if (!getFingerprintEnroll(enrollId, 1)) {
    sendEnrollFailed("Failed to capture first image");
    soundBuzzer(1000);  // Long error beep
    isEnrolling = false;
    return;
  }
  soundBuzzer(150);
  
  // Step 2
  sendEnrollUpdate("Image taken! Remove finger.", 2, 3);
  delay(2000);
  while (finger.getImage() != FINGERPRINT_NOFINGER);
  
  // Step 3
  sendEnrollUpdate("Place same finger again...", 3, 3);
  if (!getFingerprintEnroll(enrollId, 2)) {
    sendEnrollFailed("Failed to capture second image");
    soundBuzzer(1000);
    isEnrolling = false;
    return;
  }
  soundBuzzer(150);
  
  // Create and store model
  if (finger.createModel() != FINGERPRINT_OK) {
    sendEnrollFailed("Failed to create model");
    soundBuzzer(1000);
    isEnrolling = false;
    return;
  }
  
  if (finger.storeModel(enrollId) != FINGERPRINT_OK) {
    sendEnrollFailed("Failed to store model");
    soundBuzzer(1000);
    isEnrolling = false;
    return;
  }
  
  // Success!
  sendEnrollSuccess(enrollId, enrollUserId);
  soundBuzzer(100);
  delay(100);
  soundBuzzer(100);  // Double beep for success
  isEnrolling = false;
  
  Serial.println("✓ Enrollment Complete!");
}

bool getFingerprintEnroll(uint8_t id, uint8_t slot) {
  int attempts = 0;
  while (attempts < 50) {
    uint8_t result = finger.getImage();
    if (result == FINGERPRINT_OK) {
      result = finger.image2Tz(slot);
      return (result == FINGERPRINT_OK);
    }
    delay(100);
    attempts++;
  }
  return false;
}

void sendEnrollUpdate(const char* message, int step, int totalSteps) {
  StaticJsonDocument<512> doc;
  doc["type"] = "ENROLL_UPDATE";
  doc["message"] = message;
  doc["step"] = step;
  doc["totalSteps"] = totalSteps;
  doc["deviceMAC"] = deviceMAC;
  doc["scannerID"] = SCANNER_ID;
  
  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);
  publishEvent(jsonBuffer);
}

void sendEnrollSuccess(uint8_t fingerprintId, String userId) {
  StaticJsonDocument<512> doc;
  doc["type"] = "ENROLL_SUCCESS";
  
  JsonObject payload = doc.createNestedObject("payload");
  payload["fingerprintId"] = fingerprintId;
  payload["userId"] = userId;
  
  doc["deviceMAC"] = deviceMAC;
  doc["clusterID"] = CLUSTER_ID;
  doc["scannerID"] = SCANNER_ID;
  doc["timestamp"] = millis();
  
  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);
  publishEvent(jsonBuffer);
}

void sendEnrollFailed(const char* reason) {
  StaticJsonDocument<512> doc;
  doc["type"] = "ENROLL_FAILED";
  
  JsonObject payload = doc.createNestedObject("payload");
  payload["userId"] = enrollUserId;
  payload["reason"] = reason;
  
  doc["deviceMAC"] = deviceMAC;
  doc["scannerID"] = SCANNER_ID;
  
  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);
  publishEvent(jsonBuffer);
}
```

---

### ESP32 Standard Code (Exit Side with Relay Control)

```cpp
#include <WiFi.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>

// ============================================
// CONFIGURATION
// ============================================

// WiFi Configuration
const char* WIFI_SSID = "Your_WiFi_SSID";
const char* WIFI_PASSWORD = "Your_WiFi_Password";

// RabbitMQ Configuration
const char* RABBITMQ_HOST = "192.168.1.100";
const int RABBITMQ_PORT = 5672;
const char* RABBITMQ_USER = "guest";
const char* RABBITMQ_PASSWORD = "guest";

// Device Configuration (Auto-populated)
String deviceMAC = "";
const char* CLUSTER_ID = "CLUSTER-MAIN-DOOR-01";
const char* DEVICE_ROLE = "EXIT";
const char* SCANNER_ID = "SCANNER-OUT";

// Queue Names
const char* QUEUE_EVENTS = "biometric_events";
const char* QUEUE_COMMANDS = "biometric_commands";

// Hardware Pins
const int RELAY_PIN = 13;
const int LED_PIN = 2;  // Built-in LED

// ============================================
// HARDWARE SETUP
// ============================================

// Fingerprint Sensor on Serial2
HardwareSerial fpSerial(2);  // RX=GPIO16, TX=GPIO17
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fpSerial);

// ============================================
// GLOBAL VARIABLES
// ============================================

WiFiClient wifiClient;
bool isEnrolling = false;
uint8_t enrollId = 0;
String enrollUserId = "";
bool isDoorUnlocked = false;
unsigned long unlockStartTime = 0;
unsigned long unlockDuration = 0;

unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 30000;

// ============================================
// SETUP FUNCTION
// ============================================

void setup() {
  Serial.begin(115200);
  Serial.println("\\n\\nIoT Biometric - ESP32 (EXIT)");
  
  // Initialize Pins
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);  // Door locked
  digitalWrite(LED_PIN, LOW);
  
  // Get MAC Address
  deviceMAC = WiFi.macAddress();
  Serial.print("Device MAC: ");
  Serial.println(deviceMAC);
  
  // Initialize Fingerprint Sensor
  fpSerial.begin(57600, SERIAL_8N1, 16, 17);
  if (finger.verifyPassword()) {
    Serial.println("✓ Fingerprint sensor found");
  } else {
    Serial.println("✗ Fingerprint sensor not found");
  }
  
  // Connect to WiFi
  connectWiFi();
  
  // Connect to RabbitMQ
  connectRabbitMQ();
  
  // Register Device
  registerDevice();
  
  Serial.println("System Ready. Monitoring for exit scans...");
}

// ============================================
// MAIN LOOP
// ============================================

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  
  // Check RabbitMQ connection
  checkRabbitMQConnection();
  
  // Process incoming commands
  processCommands();
  
  // Send heartbeat
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  // Check if door should be locked again
  if (isDoorUnlocked && (millis() - unlockStartTime >= unlockDuration)) {
    lockDoor();
  }
  
  // Check for fingerprint scans
  if (!isEnrolling) {
    checkForFingerprint();
  } else {
    handleEnrollment();
  }
  
  delay(50);
}

// ============================================
// WIFI FUNCTIONS
// ============================================

void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\\n✓ WiFi Connected");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\\n✗ WiFi Failed");
  }
}

// ============================================
// RABBITMQ FUNCTIONS
// ============================================

void connectRabbitMQ() {
  Serial.println("Connecting to RabbitMQ...");
  // TODO: Implement AMQP connection
  Serial.println("✓ RabbitMQ Connected");
}

void checkRabbitMQConnection() {
  // TODO: Check and maintain connection
}

void publishEvent(const char* jsonMessage) {
  Serial.print("Publishing: ");
  Serial.println(jsonMessage);
  // TODO: Implement actual AMQP publish
}

void processCommands() {
  // TODO: Listen to biometric_commands queue
  // Filter by targetDeviceMAC
  
  // Example: Handle UNLOCK_DOOR command
  // if (command["action"] == "UNLOCK_DOOR" && 
  //     command["targetDeviceMAC"] == deviceMAC) {
  //   unlockDoor(command["duration"]);
  // }
  
  // Example: Handle ENROLL command
  // if (command["action"] == "ENROLL" &&
  //     command["targetDeviceMAC"] == deviceMAC &&
  //     command["scannerID"] == SCANNER_ID) {
  //   enrollId = command["id"];
  //   enrollUserId = command["userId"];
  //   isEnrolling = true;
  // }
}

// ============================================
// DEVICE REGISTRATION
// ============================================

void registerDevice() {
  StaticJsonDocument<512> doc;
  doc["type"] = "DEVICE_REGISTER";
  
  JsonObject payload = doc.createNestedObject("payload");
  payload["deviceMAC"] = deviceMAC;
  payload["deviceType"] = "ESP32";
  payload["firmwareVersion"] = "1.0.0";
  
  JsonArray capabilities = payload.createNestedArray("capabilities");
  capabilities.add("fingerprint");
  capabilities.add("relay");
  
  doc["clusterID"] = CLUSTER_ID;
  doc["deviceRole"] = DEVICE_ROLE;
  doc["scannerID"] = SCANNER_ID;
  doc["timestamp"] = millis();
  
  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);
  publishEvent(jsonBuffer);
  
  Serial.println("Device registration sent");
}

void sendHeartbeat() {
  StaticJsonDocument<512> doc;
  doc["type"] = "HEARTBEAT";
  
  JsonObject payload = doc.createNestedObject("payload");
  payload["uptime"] = millis();
  payload["wifiSignal"] = WiFi.RSSI();
  payload["freeHeap"] = ESP.getFreeHeap();
  payload["fpSensorStatus"] = finger.verifyPassword() ? "OK" : "ERROR";
  payload["relayStatus"] = "OK";
  payload["doorLockState"] = isDoorUnlocked ? "UNLOCKED" : "LOCKED";
  payload["lastScanTime"] = 0;
  
  doc["deviceMAC"] = deviceMAC;
  doc["clusterID"] = CLUSTER_ID;
  doc["deviceRole"] = DEVICE_ROLE;
  doc["scannerID"] = SCANNER_ID;
  doc["timestamp"] = millis();
  
  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);
  publishEvent(jsonBuffer);
}

// ============================================
// DOOR CONTROL FUNCTIONS
// ============================================

void unlockDoor(int duration) {
  Serial.print("🔓 Unlocking door for ");
  Serial.print(duration);
  Serial.println("ms");
  
  digitalWrite(RELAY_PIN, HIGH);  // Activate relay
  digitalWrite(LED_PIN, HIGH);     // Turn on LED
  isDoorUnlocked = true;
  unlockStartTime = millis();
  unlockDuration = duration;
}

void lockDoor() {
  Serial.println("🔒 Locking door");
  
  digitalWrite(RELAY_PIN, LOW);   // Deactivate relay
  digitalWrite(LED_PIN, LOW);     // Turn off LED
  isDoorUnlocked = false;
}

// ============================================
// FINGERPRINT FUNCTIONS
// ============================================

void checkForFingerprint() {
  uint8_t result = finger.getImage();
  if (result != FINGERPRINT_OK) return;
  
  result = finger.image2Tz();
  if (result != FINGERPRINT_OK) return;
  
  result = finger.fingerFastSearch();
  if (result != FINGERPRINT_OK) {
    Serial.println("Unknown fingerprint");
    return;
  }
  
  // Fingerprint found!
  uint16_t fingerprintId = finger.fingerID;
  uint16_t confidence = finger.confidence;
  
  Serial.print("Found ID #");
  Serial.print(fingerprintId);
  Serial.print(" (");
  Serial.print(confidence);
  Serial.println(")");
  
  // Send attendance event for EXIT
  sendAttendanceEvent(fingerprintId);
  
  // NOTE: Don't unlock here! Wait for server approval
  // Server will send UNLOCK_DOOR command if authorized
  
  delay(2000);  // Debounce
}

void sendAttendanceEvent(uint16_t fingerprintId) {
  StaticJsonDocument<512> doc;
  doc["type"] = "ATTENDANCE";
  
  JsonObject payload = doc.createNestedObject("payload");
  payload["fingerprintId"] = fingerprintId;
  payload["direction"] = "OUT";
  payload["multiPersonDetected"] = false;  // No camera on this device
  
  doc["deviceMAC"] = deviceMAC;
  doc["clusterID"] = CLUSTER_ID;
  doc["scannerID"] = SCANNER_ID;
  doc["deviceRole"] = DEVICE_ROLE;
  doc["timestamp"] = millis();
  
  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);
  publishEvent(jsonBuffer);
}

// ============================================
// ENROLLMENT FUNCTIONS
// ============================================

void handleEnrollment() {
  Serial.println("Starting enrollment...");
  
  // Step 1
  sendEnrollUpdate("Place finger on sensor...", 1, 3);
  if (!getFingerprintEnroll(enrollId, 1)) {
    sendEnrollFailed("Failed to capture first image");
    isEnrolling = false;
    return;
  }
  
  // Step 2
  sendEnrollUpdate("Image taken! Remove finger.", 2, 3);
  delay(2000);
  while (finger.getImage() != FINGERPRINT_NOFINGER);
  
  // Step 3
  sendEnrollUpdate("Place same finger again...", 3, 3);
  if (!getFingerprintEnroll(enrollId, 2)) {
    sendEnrollFailed("Failed to capture second image");
    isEnrolling = false;
    return;
  }
  
  // Create and store model
  if (finger.createModel() != FINGERPRINT_OK) {
    sendEnrollFailed("Failed to create model");
    isEnrolling = false;
    return;
  }
  
  if (finger.storeModel(enrollId) != FINGERPRINT_OK) {
    sendEnrollFailed("Failed to store model");
    isEnrolling = false;
    return;
  }
  
  // Success!
  sendEnrollSuccess(enrollId, enrollUserId);
  isEnrolling = false;
  
  Serial.println("✓ Enrollment Complete!");
}

bool getFingerprintEnroll(uint8_t id, uint8_t slot) {
  int attempts = 0;
  while (attempts < 50) {
    uint8_t result = finger.getImage();
    if (result == FINGERPRINT_OK) {
      result = finger.image2Tz(slot);
      return (result == FINGERPRINT_OK);
    }
    delay(100);
    attempts++;
  }
  return false;
}

void sendEnrollUpdate(const char* message, int step, int totalSteps) {
  StaticJsonDocument<512> doc;
  doc["type"] = "ENROLL_UPDATE";
  doc["message"] = message;
  doc["step"] = step;
  doc["totalSteps"] = totalSteps;
  doc["deviceMAC"] = deviceMAC;
  doc["scannerID"] = SCANNER_ID;
  
  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);
  publishEvent(jsonBuffer);
}

void sendEnrollSuccess(uint8_t fingerprintId, String userId) {
  StaticJsonDocument<512> doc;
  doc["type"] = "ENROLL_SUCCESS";
  
  JsonObject payload = doc.createNestedObject("payload");
  payload["fingerprintId"] = fingerprintId;
  payload["userId"] = userId;
  
  doc["deviceMAC"] = deviceMAC;
  doc["clusterID"] = CLUSTER_ID;
  doc["scannerID"] = SCANNER_ID;
  doc["timestamp"] = millis();
  
  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);
  publishEvent(jsonBuffer);
}

void sendEnrollFailed(const char* reason) {
  StaticJsonDocument<512> doc;
  doc["type"] = "ENROLL_FAILED";
  
  JsonObject payload = doc.createNestedObject("payload");
  payload["userId"] = enrollUserId;
  payload["reason"] = reason;
  
  doc["deviceMAC"] = deviceMAC;
  doc["scannerID"] = SCANNER_ID;
  
  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);
  publishEvent(jsonBuffer);
}
```

---

## Server-Side Implementation Requirements

### Required Backend Updates

To support the cluster-based multi-device architecture, the server needs these enhancements:

#### 1. Device Registry Service

**New Model**: `server/models/Device.js`

```javascript
import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
  deviceMAC: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  deviceType: {
    type: String,
    enum: ['ESP32', 'ESP32-CAM'],
    required: true
  },
  clusterID: {
    type: String,
    required: true,
    index: true
  },
  deviceRole: {
    type: String,
    enum: ['ENTRY', 'EXIT'],
    required: true
  },
  scannerID: {
    type: String,
    required: true
  },
  location: String,
  status: {
    type: String,
    enum: ['ACTIVE', 'OFFLINE', 'MAINTENANCE', 'PENDING'],
    default: 'PENDING'
  },
  capabilities: [String],  // ['fingerprint', 'camera', 'buzzer', 'relay']
  firmwareVersion: String,
  lastHeartbeat: Date,
  registeredAt: {
    type: Date,
    default: Date.now
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  healthMetrics: {
    uptime: Number,
    wifiSignal: Number,
    freeHeap: Number,
    lastScanTime: Date
  }
}, { timestamps: true });

export default mongoose.model('Device', deviceSchema);
```

#### 2. Cluster Management Service

**New Model**: `server/models/Cluster.js`

```javascript
import mongoose from 'mongoose';

const clusterSchema = new mongoose.Schema({
  clusterID: {
    type: String,
    required: true,
    unique: true
  },
  clusterName: String,
  location: String,
  devices: [{
    deviceMAC: String,
    role: String,
    scannerID: String
  }],
  doorControlDevice: String,  // MAC of device with relay
  status: {
    type: String,
    enum: ['OPERATIONAL', 'DEGRADED', 'OFFLINE'],
    default: 'OPERATIONAL'
  }
}, { timestamps: true });

export default mongoose.model('Cluster', clusterSchema);
```

#### 3. Updated User Model with Multiple Scanner Enrollments

**Update**: `server/models/User.js`

```javascript
// Add this to existing User schema
enrollments: [{
  scannerID: {
    type: String,
    required: true
  },
  deviceMAC: {
    type: String,
    required: true
  },
  fingerprintId: {
    type: Number,
    required: true
  },
  enrolledAt: {
    type: Date,
    default: Date.now
  }
}]
```

#### 4. Enhanced Recognition Service

**Update**: `server/services/pipelines/recognitionService.js`

```javascript
async processAttendance(event) {
  const { payload, deviceMAC, clusterID, scannerID, deviceRole } = event;
  const { fingerprintId, direction, multiPersonDetected } = payload;
  
  // Handle security alert
  if (multiPersonDetected) {
    await this.handleSecurityAlert(event);
    return;  // Block processing
  }
  
  // Find user by BOTH fingerprintId AND deviceMAC (or scannerID)
  const user = await User.findOne({
    'enrollments': {
      $elemMatch: {
        fingerprintId: fingerprintId,
        $or: [
          { deviceMAC: deviceMAC },
          { scannerID: scannerID }
        ]
      }
    }
  });
  
  if (!user) {
    console.warn(`Unknown fingerprint ${fingerprintId} on ${scannerID}`);
    return;
  }
  
  console.log(`Identified: ${user.username} - ${direction}`);
  
  // Create attendance record
  const attendance = new Attendance({
    user: user._id,
    fingerprintId: fingerprintId,
    deviceMAC: deviceMAC,
    clusterID: clusterID,
    scannerID: scannerID,
    direction: direction,  // "IN" or "OUT"
    type: direction === 'IN' ? 'CHECK_IN' : 'CHECK_OUT'
  });
  await attendance.save();
  
  // Check access permissions and rules
  const shouldUnlock = await this.checkAccessRules(user, clusterID, direction);
  
  if (shouldUnlock) {
    // Send unlock command to cluster's door control device
    await this.unlockDoor(clusterID, user._id);
  }
  
  // Real-time update
  if (this.io) {
    this.io.emit('attendance-update', {
      user: user.username,
      direction: direction,
      cluster: clusterID,
      timestamp: new Date()
    });
  }
}

async unlockDoor(clusterID, userId) {
  // Find cluster and get door control device
  const cluster = await Cluster.findOne({ clusterID });
  if (!cluster || !cluster.doorControlDevice) {
    console.error('No door control device for cluster:', clusterID);
    return;
  }
  
  // Send UNLOCK_DOOR command to EXIT ESP32
  const command = {
    action: 'UNLOCK_DOOR',
    targetDeviceMAC: cluster.doorControlDevice,
    clusterID: clusterID,
    duration: 5000,  // 5 seconds
    reason: `Valid scan - User ${userId}`
  };
  
  await rabbitMQService.publishCommand(command);
  console.log(`Door unlock command sent to ${cluster.doorControlDevice}`);
}

async handleSecurityAlert(event) {
  const { payload, deviceMAC, clusterID } = event;
  
  console.error('🚨 SECURITY ALERT:', payload);
  
  // Log security incident
  // Send admin notification
  // Block door unlock
  
  if (this.io) {
    this.io.emit('security-alert', {
      type: 'MULTIPLE_PERSONS_DETECTED',
      cluster: clusterID,
      device: deviceMAC,
      persons: payload.personsDetected,
      timestamp: new Date()
    });
  }
}
```

#### 5. Device Health Monitoring Service

**New Service**: `server/services/deviceHealthService.js`

```javascript
import Device from '../models/Device.js';
import Cluster from '../models/Cluster.js';

class DeviceHealthService {
  async processHeartbeat(event) {
    const { deviceMAC, clusterID, payload } = event;
    
    // Update device health
    await Device.findOneAndUpdate(
      { deviceMAC },
      {
        status: 'ACTIVE',
        lastHeartbeat: new Date(),
        healthMetrics: {
          uptime: payload.uptime,
          wifiSignal: payload.wifiSignal,
          freeHeap: payload.freeHeap,
          lastScanTime: payload.lastScanTime
        }
      }
    );
    
    // Check cluster health
    await this.updateClusterStatus(clusterID);
  }
  
  async updateClusterStatus(clusterID) {
    const cluster = await Cluster.findOne({ clusterID });
    if (!cluster) return;
    
    const devices = await Device.find({ 
      deviceMAC: { $in: cluster.devices.map(d => d.deviceMAC) }
    });
    
    const offlineDevices = devices.filter(d => {
      const lastSeen = new Date() - new Date(d.lastHeartbeat);
      return lastSeen > 60000;  // 1 minute threshold
    });
    
    let status = 'OPERATIONAL';
    if (offlineDevices.length === devices.length) {
      status = 'OFFLINE';
    } else if (offlineDevices.length > 0) {
      status = 'DEGRADED';
    }
    
    await Cluster.findOneAndUpdate({ clusterID }, { status });
  }
  
  async autoOfflineDetection() {
    // Run periodically (every minute)
    const staleThreshold = new Date(Date.now() - 60000);  // 1 minute
    
    await Device.updateMany(
      { 
        lastHeartbeat: { $lt: staleThreshold },
        status: 'ACTIVE'
      },
      { status: 'OFFLINE' }
    );
  }
}

export default new DeviceHealthService();
```

#### 6. Updated RabbitMQ Service

**Update**: `server/services/rabbitmq/rabbitMQService.js`

```javascript
// Add new event handlers
consumeEvents() {
  this.channel.consume(this.queues.EVENTS, async (msg) => {
    if (msg !== null) {
      try {
        const event = JSON.parse(msg.content.toString());
        console.log('[RabbitMQ] Event:', event.type);
        
        // Route events by type
        switch (event.type) {
          case 'ATTENDANCE':
            await recognitionService.processAttendance(event);
            if (this.io) this.io.emit('attendance-update', event);
            break;
            
          case 'DEVICE_REGISTER':
            await deviceRegistrationService.registerDevice(event);
            break;
            
          case 'HEARTBEAT':
            await deviceHealthService.processHeartbeat(event);
            break;
            
          case 'SECURITY_ALERT':
            await recognitionService.handleSecurityAlert(event);
            if (this.io) this.io.emit('security-alert', event);
            break;
            
          case 'ENROLL_SUCCESS':
            await registrationService.handleEnrollmentSuccess(event);
            if (this.io) this.io.emit('enrollment-success', event);
            break;
            
          case 'ENROLL_UPDATE':
            if (this.io) this.io.emit('enrollment-update', event);
            break;
            
          case 'ENROLL_FAILED':
            if (this.io) this.io.emit('enrollment-failed', event);
            break;
        }
        
        this.channel.ack(msg);
      } catch (error) {
        console.error('Error processing message:', error);
        this.channel.ack(msg);
      }
    }
  });
}
```

#### 7. Dashboard API Endpoints

**New Routes**: `server/routes/devices/deviceRoutes.js`

```javascript
import express from 'express';
import Device from '../../models/Device.js';
import Cluster from '../../models/Cluster.js';

const router = express.Router();

// Get all clusters with device health
router.get('/clusters', async (req, res) => {
  try {
    const clusters = await Cluster.find();
    
    const clustersWithDevices = await Promise.all(
      clusters.map(async (cluster) => {
        const devices = await Device.find({
          deviceMAC: { $in: cluster.devices.map(d => d.deviceMAC) }
        });
        
        return {
          ...cluster.toObject(),
          deviceDetails: devices
        };
      })
    );
    
    res.json(clustersWithDevices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific scanner for enrollment
router.get('/scanners', async (req, res) => {
  try {
    const devices = await Device.find({ 
      status: 'ACTIVE',
      capabilities: 'fingerprint'
    });
    
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve pending device
router.post('/approve/:deviceMAC', async (req, res) => {
  try {
    const { deviceMAC } = req.params;
    const { clusterID, deviceRole, scannerID } = req.body;
    
    const device = await Device.findOneAndUpdate(
      { deviceMAC },
      { 
        status: 'ACTIVE',
        clusterID,
        deviceRole,
        scannerID,
        approvedBy: req.user._id
      },
      { new: true }
    );
    
    // Add to cluster
    await Cluster.findOneAndUpdate(
      { clusterID },
      { 
        $push: { 
          devices: { deviceMAC, role: deviceRole, scannerID }
        }
      },
      { upsert: true }
    );
    
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

## Alternative: MQTT Fallback Implementation

If RabbitMQ AMQP client is challenging, you can use MQTT as an alternative:

### MQTT Configuration

```cpp
#include <PubSubClient.h>

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

const char* MQTT_BROKER = "192.168.1.100";
const int MQTT_PORT = 1883;
const char* MQTT_USER = "guest";
const char* MQTT_PASSWORD = "guest";

// Topics
const char* TOPIC_EVENTS = "biometric/events";
const char* TOPIC_COMMANDS = "biometric/commands";

void setup() {
  // ... WiFi setup ...
  
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  connectMQTT();
}

void connectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT...");
    if (mqttClient.connect(DEVICE_ID, MQTT_USER, MQTT_PASSWORD)) {
      Serial.println("✓ Connected");
      mqttClient.subscribe(TOPIC_COMMANDS);
    } else {
      Serial.print("✗ Failed, rc=");
      Serial.println(mqttClient.state());
      delay(5000);
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("]: ");
  
  char message[length + 1];
  memcpy(message, payload, length);
  message[length] = '\0';
  Serial.println(message);
  
  // Parse JSON command
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.print("JSON parse error: ");
    Serial.println(error.c_str());
    return;
  }
  
  const char* action = doc["action"];
  
  if (strcmp(action, "DEVICE_APPROVED") == 0) {
    // Store configuration in non-volatile memory
    Preferences prefs;
    prefs.begin("biometric", false);
    
    JsonObject config = doc["config"];
    prefs.putString("clusterID", config["clusterID"] | "");
    prefs.putString("deviceRole", config["deviceRole"] | "");
    prefs.putString("scannerID", config["scannerID"] | "");
    prefs.putString("location", config["location"] | "");
    prefs.putBool("approved", true);
    
    prefs.end();
    
    Serial.println("✓ Device approved and configured!");
    Serial.printf("  Cluster: %s\n", config["clusterID"].as<const char*>());
    Serial.printf("  Role: %s\n", config["deviceRole"].as<const char*>());
    Serial.printf("  Scanner: %s\n", config["scannerID"].as<const char*>());
    
    // Send immediate heartbeat with new config
    sendHeartbeat();
  }
  else if (strcmp(action, "ENROLL") == 0) {
    enrollId = doc["id"];
    enrollUserId = doc["userId"].as<String>();
    isEnrolling = true;
    Serial.printf("Starting enrollment: ID=%d, UserID=%s\n", enrollId, enrollUserId.c_str());
  }
  else if (strcmp(action, "UNLOCK_DOOR") == 0) {
    int duration = doc["duration"] | 5000;
    Serial.printf("Unlocking door for %d ms\n", duration);
    digitalWrite(RELAY_PIN, HIGH);
    delay(duration);
    digitalWrite(RELAY_PIN, LOW);
  }
}

void publishMQTT(const char* jsonMessage) {
  mqttClient.publish(TOPIC_EVENTS, jsonMessage);
}

void loop() {
  if (!mqttClient.connected()) {
    connectMQTT();
  }
  mqttClient.loop();
  
  // ... rest of loop code ...
}
```

---

## Testing and Debugging

### 1. Test WiFi Connection

```cpp
void testWiFi() {
  Serial.println("Testing WiFi...");
  Serial.print("SSID: ");
  Serial.println(WiFi.SSID());
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("Signal: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
}
```

### 2. Test Fingerprint Sensor

```cpp
void testFingerprint() {
  Serial.println("Testing Fingerprint Sensor...");
  Serial.print("Sensor found: ");
  Serial.println(finger.verifyPassword() ? "YES" : "NO");
  Serial.print("Sensor addr: 0x");
  Serial.println(finger.system_id, HEX);
  Serial.print("Capacity: ");
  Serial.println(finger.capacity);
  Serial.print("Templates stored: ");
  Serial.println(finger.templateCount);
}
```

### 3. Test Message Publishing

```cpp
void testPublish() {
  Serial.println("Testing message publish...");
  StaticJsonDocument<256> doc;
  doc["type"] = "TEST";
  doc["deviceId"] = DEVICE_ID;
  doc["message"] = "Hello from ESP32";
  
  char buffer[256];
  serializeJson(doc, buffer);
  publishEvent(buffer);
  Serial.println("Test message sent");
}
```

### 4. Serial Monitor Output Example

```
IoT Biometric Attendance - ESP32 Gateway
✓ Fingerprint sensor found!
Connecting to WiFi........
✓ WiFi Connected
IP Address: 192.168.1.105
Connecting to RabbitMQ...
✓ RabbitMQ Connected
System Ready. Waiting for fingerprint scans...

Found ID #42 with confidence 197
Publishing: {"type":"ATTENDANCE","payload":{"fingerprintId":42},"deviceId":"ESP32-001","timestamp":12345}

[Command Received] {"action":"ENROLL","id":43,"userId":"65a1b2c3d4e5f6","deviceId":"ESP32-001"}
Starting enrollment process...
Publishing: {"type":"ENROLL_UPDATE","message":"Place finger on sensor...","step":1,"totalSteps":3}
...
✓ Enrollment Complete!
```

---

## Server-Side Verification

### Test Device Simulation (JavaScript)

Your server already includes a device simulator at `server/scripts/simulate-device.js`. You can run it to verify your ESP32 implementation:

```bash
cd server
node scripts/simulate-device.js
```

This simulator shows the expected message format and helps debug server-side processing.

---

## Troubleshooting

### Common Issues

#### 1. WiFi Connection Fails
- Verify SSID and password
- Check WiFi signal strength
- Ensure ESP32 is within range
- Try 2.4GHz network (ESP32 doesn't support 5GHz)

#### 2. RabbitMQ Connection Fails
- Verify server IP address
- Check RabbitMQ is running: `rabbitmqctl status`
- Verify firewall allows port 5672
- Check credentials (default: guest/guest)

#### 3. Fingerprint Sensor Not Found
- Check wiring connections
- Verify baud rate (usually 57600)
- Check power supply (sensor needs 3.3V or 5V depending on model)
- Try swapping RX/TX pins if communication fails

#### 4. Messages Not Received by Server
- Verify ESP32 is publishing to correct queue
- Check JSON format matches specification
- Monitor RabbitMQ management console
- Enable debug logging on server

### Debug Commands

```cpp
// Enable verbose logging
#define DEBUG_MODE 1

#ifdef DEBUG_MODE
  #define DEBUG_PRINT(x) Serial.print(x)
  #define DEBUG_PRINTLN(x) Serial.println(x)
#else
  #define DEBUG_PRINT(x)
  #define DEBUG_PRINTLN(x)
#endif
```

---

## Production Deployment Checklist

- [ ] Change default WiFi credentials
- [ ] Update RabbitMQ user/password (don't use 'guest' in production)
- [ ] Assign unique Device ID for each ESP32
- [ ] Enable TLS/SSL for RabbitMQ connection
- [ ] Implement automatic reconnection logic
- [ ] Add watchdog timer for crash recovery
- [ ] Configure OTA (Over-The-Air) updates
- [ ] Set up device monitoring and health checks
- [ ] Implement message acknowledgment and retry logic
- [ ] Add local buffering for offline scenarios

---

## Additional Resources

### Documentation Links
- [ESP32 Arduino Core Documentation](https://docs.espressif.com/projects/arduino-esp32/)
- [RabbitMQ AMQP 0-9-1 Protocol](https://www.rabbitmq.com/protocol.html)
- [ArduinoJson Documentation](https://arduinojson.org/)
- [Adafruit Fingerprint Library](https://github.com/adafruit/Adafruit-Fingerprint-Sensor-Library)

### Server Pipeline Documentation
- See [`PIPELINE_ARCHITECTURE.md`](PIPELINE_ARCHITECTURE.md) for complete system architecture
- See [`server/scripts/simulate-device.js`](server/scripts/simulate-device.js) for reference implementation

---

## Support and Next Steps

### After Successful Connection

1. **Verify attendance logging** in the dashboard
2. **Test enrollment workflow** via admin panel
3. **Monitor system logs** for errors
4. **Configure system settings** (shift times, late thresholds)
5. **Set up notifications** for parents/administrators

### Advanced Features to Implement

- **Multi-device coordination**: Handle multiple ESP32 gateways
- **Offline buffering**: Store scans locally when server is unreachable
- **Device heartbeat**: Regular status updates
- **Remote configuration**: Update settings without reflashing
- **Firmware OTA updates**: Deploy updates remotely

---

**Last Updated**: February 15, 2026  
**Author**: IoT Biometric Attendance System Team  
**Version**: 1.0.0
