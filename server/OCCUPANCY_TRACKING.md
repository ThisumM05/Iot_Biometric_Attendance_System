# Occupancy Tracking System - Documentation

## 📊 Overview

The **Occupancy Tracking System** is a real-time monitoring solution that tracks the number of persons detected in biometric authentication areas, triggers alerts when occupancy exceeds configured thresholds, and provides WebSocket-based real-time notifications to admin dashboards.

---

## ✨ Features

### 1. **Real-Time Occupancy Monitoring**
- Maintains current occupancy state in memory for each device
- Tracks person count and detects entry/exit events
- Updates in real-time via WebSocket broadcasts

### 2. **Smart Alert System**
- **Severity Levels:**
  - `WARNING`: 2 persons detected
  - `CRITICAL`: 3+ persons detected
  - `CRITICAL` (escalated): Multiple persons during fingerprint authentication

- **Cooldown Mechanism:**
  - Prevents repeated alarms within 10 seconds
  - Configurable cooldown period

### 3. **Event Detection**
- `ENTRY`: Person count increases
- `EXIT`: Person count decreases
- `NO_CHANGE`: Count remains the same

### 4. **WebSocket Notifications**
Real-time broadcasts to connected admin dashboards:
- `occupancy:update` - Current state changes
- `occupancy:alert` - Alert triggered
- `occupancy:alert:resolved` - Alert resolved
- `occupancy:reset` - Device occupancy reset

### 5. **Persistent Logging**
All occupancy changes are stored in MongoDB with:
- Timestamp, device ID, location
- Event type and person count
- Alert status and severity
- Snapshot metadata (image, detection box)
- Resolution tracking

---

## 🔧 Configuration

### Default Settings
```javascript
{
  MAX_ALLOWED_PERSONS: 1,
  COOLDOWN_PERIOD_MS: 10000 // 10 seconds
}
```

### Update Configuration
```http
PUT /api/occupancy/config
Content-Type: application/json

{
  "MAX_ALLOWED_PERSONS": 2,
  "COOLDOWN_PERIOD_MS": 15000
}
```

---

## 🚀 API Endpoints

### 1. Update Occupancy
**POST** `/api/occupancy/update`

Updates the current occupancy count for a device and triggers alerts if necessary.

**Request Body:**
```json
{
  "deviceId": "DEVICE_001",
  "personCount": 2,
  "location": "Main Entrance",
  "fingerprintScanAttempt": true,
  "userId": "698d001e0a53acabaa776f68",
  "snapshotMetadata": {
    "imageUrl": "/snapshots/2024-01-15_10-30-45.jpg",
    "confidence": 0.95,
    "detectionBox": {
      "x": 100,
      "y": 150,
      "width": 200,
      "height": 250
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "event": {
    "eventType": "ENTRY",
    "personCount": 2,
    "previousCount": 1,
    "change": 1
  },
  "alert": {
    "triggered": true,
    "severity": "WARNING",
    "message": "WARNING: 2 persons detected at DEVICE_001",
    "inCooldown": false
  },
  "log": { /* OccupancyLog document */ },
  "currentState": {
    "personCount": 2,
    "lastUpdate": "2026-02-12T00:00:00.000Z",
    "location": "Main Entrance"
  }
}
```

---

### 2. Get Occupancy Logs
**GET** `/api/occupancy/logs`

Retrieve occupancy logs with filtering options.

**Query Parameters:**
- `deviceId` - Filter by device
- `startDate` - Start date (ISO 8601)
- `endDate` - End date (ISO 8601)
- `eventType` - ENTRY, EXIT, NO_CHANGE
- `alertTriggered` - true/false
- `resolved` - true/false
- `limit` - Max results (default: 100)
- `skip` - Pagination offset

**Example:**
```http
GET /api/occupancy/logs?deviceId=DEVICE_001&alertTriggered=true&resolved=false&limit=50
```

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [ /* Array of OccupancyLog documents */ ],
    "total": 150,
    "limit": 50,
    "skip": 0
  }
}
```

---

### 3. Get Active Alerts
**GET** `/api/occupancy/alerts/active`

Retrieve all unresolved alerts.

**Response:**
```json
{
  "success": true,
  "count": 3,
  "alerts": [
    {
      "_id": "698d173968368428362df341",
      "timestamp": "2026-02-12T00:00:00.000Z",
      "personCount": 3,
      "deviceId": "DEVICE_001",
      "alertSeverity": "CRITICAL",
      "alertMessage": "CRITICAL: 3 persons detected at DEVICE_001",
      "resolved": false
    }
  ]
}
```

---

### 4. Resolve Alert
**PUT** `/api/occupancy/alerts/:id/resolve`

Mark an alert as resolved.

**Request Body:**
```json
{
  "resolvedBy": "698d001e0a53acabaa776f67",
  "notes": "False alarm - authorized maintenance"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* Updated OccupancyLog with resolved fields */ }
}
```

---

### 5. Get Statistics
**GET** `/api/occupancy/statistics`

Get aggregated occupancy statistics.

**Query Parameters:**
- `deviceId` - Filter by device
- `startDate` - Start date
- `endDate` - End date

**Response:**
```json
{
  "success": true,
  "data": {
    "totalLogs": 542,
    "events": {
      "entries": 280,
      "exits": 262,
      "noChange": 0
    },
    "alerts": {
      "total": 15,
      "warning": 8,
      "critical": 7,
      "unresolved": 3,
      "resolved": 12
    },
    "occupancy": {
      "average": 0.85,
      "peak": 4
    },
    "currentStates": [
      {
        "deviceId": "DEVICE_001",
        "personCount": 0,
        "lastUpdate": "2026-02-12T00:00:00.000Z",
        "location": "Main Entrance"
      }
    ]
  }
}
```

---

### 6. Get Current State
**GET** `/api/occupancy/current-state`

Get current occupancy state for all devices or a specific device.

**Query Parameters:**
- `deviceId` (optional) - Get state for specific device

**Response (all devices):**
```json
{
  "success": true,
  "states": [
    {
      "deviceId": "DEVICE_001",
      "personCount": 2,
      "lastUpdate": "2026-02-12T00:00:00.000Z",
      "location": "Main Entrance"
    }
  ]
}
```

---

### 7. Reset Occupancy
**POST** `/api/occupancy/reset`

Manually reset occupancy count for a device.

**Request Body:**
```json
{
  "deviceId": "DEVICE_001"
}
```

**Response:**
```json
{
  "success": true,
  "deviceId": "DEVICE_001",
  "state": {
    "personCount": 0,
    "lastUpdate": "2026-02-12T00:00:00.000Z"
  }
}
```

---

### 8. Get Configuration
**GET** `/api/occupancy/config`

Retrieve current configuration.

**Response:**
```json
{
  "success": true,
  "config": {
    "MAX_ALLOWED_PERSONS": 1,
    "COOLDOWN_PERIOD_MS": 10000,
    "COOLDOWN_PERIOD_SECONDS": 10
  }
}
```

---

### 9. Update Configuration
**PUT** `/api/occupancy/config`

Update system configuration.

**Request Body:**
```json
{
  "MAX_ALLOWED_PERSONS": 2,
  "COOLDOWN_PERIOD_MS": 15000
}
```

---

## 📡 WebSocket Integration

### Connect to WebSocket
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('Connected');
  socket.emit('join:occupancy');
});
```

### Listen for Events
```javascript
// Occupancy update
socket.on('occupancy:update', (data) => {
  console.log('Update:', data);
  // data: { deviceId, currentState, event }
});

// Alert triggered
socket.on('occupancy:alert', (data) => {
  console.log('Alert:', data);
  // data: { deviceId, personCount, severity, message, timestamp, logId }
});

// Alert resolved
socket.on('occupancy:alert:resolved', (data) => {
  console.log('Resolved:', data);
  // data: { alertId, resolvedBy, resolvedAt }
});

// Device reset
socket.on('occupancy:reset', (data) => {
  console.log('Reset:', data);
  // data: { deviceId, state }
});
```

---

## 🗄️ MongoDB Schema

### OccupancyLog Model
```javascript
{
  timestamp: Date,
  personCount: Number,
  previousCount: Number,
  eventType: 'ENTRY' | 'EXIT' | 'NO_CHANGE',
  deviceId: String,
  location: String,
  alertTriggered: Boolean,
  alertSeverity: 'NONE' | 'WARNING' | 'CRITICAL',
  alertMessage: String,
  fingerprintScanAttempt: Boolean,
  userId: ObjectId, // ref: User
  snapshotMetadata: {
    imageUrl: String,
    confidence: Number,
    detectionBox: { x, y, width, height }
  },
  resolved: Boolean,
  resolvedAt: Date,
  resolvedBy: ObjectId, // ref: User
  notes: String
}
```

---

## 🎯 Use Cases

### 1. Prevent Spoofing/Buddy Punching
```javascript
// When fingerprint scan happens with multiple persons
{
  "deviceId": "DEVICE_001",
  "personCount": 2,
  "fingerprintScanAttempt": true,
  "userId": "698d001e0a53acabaa776f68"
}
// → Triggers CRITICAL alert
```

### 2. Monitor High Traffic Areas
```javascript
// Track entries/exits in real-time
GET /api/occupancy/statistics?deviceId=DEVICE_001&startDate=2026-02-12T00:00:00Z
```

### 3. Security Compliance
```javascript
// Get all unresolved alerts for security review
GET /api/occupancy/alerts/active
```

---

## 🧪 Testing

Run the comprehensive test suite:
```bash
cd server
node testOccupancyTracking.js
```

**Test Coverage:**
1. ✅ Normal entry (1 person)
2. ✅ Warning alert (2 persons)
3. ✅ Cooldown mechanism
4. ✅ Critical alert after cooldown
5. ✅ Critical alert during fingerprint scan
6. ✅ Exit event detection
7. ✅ Statistics aggregation
8. ✅ Active alert retrieval

---

## 📊 Frontend Dashboard

Access the Occupancy Monitor dashboard:
```
http://localhost:5173/occupancy
```

**Features:**
- Real-time occupancy display
- Active alert notifications with sound
- Statistics overview cards
- Device state monitoring
- Alert resolution interface
- Configuration display
- Manual device reset

---

## 🔐 Security Considerations

1. **Authentication**: Add middleware to protect endpoints
2. **Rate Limiting**: Prevent API abuse
3. **Validation**: All inputs are validated
4. **Audit Trail**: All events logged with timestamps
5. **WebSocket Auth**: Implement socket authentication

---

## 📈 Performance

- **In-Memory State**: O(1) lookups for current state
- **Cooldown Tracking**: Efficient Map-based tracking
- **Database Indexes**: Optimized queries on timestamp, deviceId
- **WebSocket**: Real-time updates without polling

---

## 🛠️ Integration Example

### IoT Device Integration
```python
import requests

# Update occupancy from camera/sensor
response = requests.post('http://localhost:5000/api/occupancy/update', json={
    'deviceId': 'CAMERA_001',
    'personCount': 2,
    'location': 'Main Entrance',
    'snapshotMetadata': {
        'imageUrl': '/snapshots/img_001.jpg',
        'confidence': 0.95,
        'detectionBox': { 'x': 100, 'y': 150, 'width': 200, 'height': 250}
    }
})

print(response.json())
```

---

## 📝 Notes

- Occupancy state is **in-memory** and will reset on server restart
- Historical data is **persistent** in MongoDB
- WebSocket connections auto-reconnect
- Cooldown is per-device, not global
- Alerts can be retroactively resolved

---

**Version:** 1.0.0  
**Last Updated:** February 12, 2026
