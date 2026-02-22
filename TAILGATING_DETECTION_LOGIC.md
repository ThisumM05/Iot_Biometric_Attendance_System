# Tailgating Detection System - Logic Flow

## Overview
This system detects unauthorized entry (tailgating) by correlating three data sources:
1. **Fingerprint Scanner** - Authorized entries
2. **Camera** - Face detection count
3. **IR Beam Sensor** - Actual people passing through

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    TAILGATING DETECTION FLOW                 │
└─────────────────────────────────────────────────────────────┘

1️⃣  FINGERPRINT SCAN (Trigger)
    │
    ├─→ User scans fingerprint
    │
    ├─→ Server receives MQTT event (biometric/events)
    │
    ├─→ recognitionService.processAttendance()
    │
    ├─→ User identified & authorized ✓
    │
    └─→ tailgatingDetection.startSession(deviceId, userId, timestamp)
         │
         └─→ Creates 10-second detection window
              │
              ├─ authorized: 1
              ├─ actualPassed: 0
              └─ status: 'active'

2️⃣  CAMERA MONITORING (Continuous)
    │
    ├─→ ESP32-CAM sends frames via WebSocket
    │
    ├─→ cameraStreamService.handleBinaryFrame()
    │
    ├─→ detectFaces(frameData) → count
    │
    └─→ tailgatingDetection.recordFaceDetection(deviceId, count, timestamp)
         │
         └─→ If count > authorized for >3 seconds
              └─→ Emit 'extraFacesDetected' ⚠️

3️⃣  IR BEAM CROSSING (Event-driven)
    │
    ├─→ IR sensor detects beam break
    │
    ├─→ ESP32 sends crossing event (direction: IN/OUT)
    │
    ├─→ POST /api/ir-beam/crossing
    │
    └─→ tailgatingDetection.recordBeamCrossing(deviceId, direction)
         │
         ├─→ actualPassed++
         │
         └─→ CRITICAL CHECK:
              If actualPassed > authorized
              └─→ Emit 'tailgatingDetected' 🚨

4️⃣  ALARM TRIGGER
    │
    ├─→ cameraStreamService receives 'tailgatingDetected' event
    │
    ├─→ Sends TRIGGER_ALARM via WebSocket to ESP32
    │
    ├─→ ESP32 activates buzzer (GPIO 12)
    │
    └─→ Dashboard shows alert via Socket.IO

5️⃣  SESSION CLOSURE (After 10 seconds)
    │
    ├─→ Evaluate final counts
    │
    └─→ Status: completed | alarmed
```

## Logic Rules

### Scenario Matrix

| Scans | Faces | Beam | Result      | Action                                 |
| ----- | ----- | ---- | ----------- | -------------------------------------- |
| 1     | 1     | 1    | ✅ **ALLOW** | Normal entry                           |
| 1     | 2     | 1    | ⚠️ **WARN**  | Extra face detected, but only 1 passed |
| 1     | 2     | 2    | 🚨 **ALARM** | TAILGATING: 2 passed, 1 authorized     |
| 2     | 2     | 2    | ✅ **ALLOW** | Both authorized                        |
| 1     | 1     | 2    | 🚨 **ALARM** | Someone followed after scan            |
| 0     | 1     | 1    | 🚨 **ALARM** | No scan, unauthorized entry            |
| 1     | 3     | 1    | ⚠️ **WARN**  | Crowd waiting, only 1 entered          |

### Alarm Conditions

```javascript
// IMMEDIATE ALARM (Real-time)
if (actualPassed > authorized) {
  triggerAlarm("Tailgating detected");
}

// WARNING (3-second threshold)
if (faceCount > authorized && duration > 3000) {
  emitWarning("Extra faces persisting");
}

// UNAUTHORIZED ENTRY (No session)
if (beamCrossing && !activeSession) {
  triggerAlarm("Entry without authorization");
}
```

## Implementation Status

### ✅ Completed Components

1. **Tailgating Detection Service** (`tailgatingDetection.js`)
   - Session management with 10-second windows
   - Event correlation (fingerprints, faces, beam crossings)
   - Alarm triggering logic
   - Event emitters for real-time notifications

2. **Camera Integration** (`cameraStreamService.js`)
   - WebSocket streaming from ESP32-CAM
   - Face detection recording
   - Alarm command transmission
   - Dashboard broadcasting

3. **Fingerprint Integration** (`recognitionService.js`)
   - Session start on successful scan
   - User authentication
   - Multiple scan support within session

4. **IR Beam API** (`irBeamRoutes.js`)
   - `/api/ir-beam/crossing` - Record beam events
   - `/api/ir-beam/test` - Simulate crossings
   - `/api/ir-beam/sessions` - Debug active sessions

### ⚠️ Pending Hardware Integration

1. **IR Beam Sensor**
   - Hardware: Not yet connected
   - GPIO: To be configured
   - Protocol: MQTT or HTTP POST to `/api/ir-beam/crossing`
   - Format: `{ deviceId, direction: "IN"|"OUT", timestamp }`

2. **Face Detection Model**
   - Current: Placeholder (random 0-2)
   - Needed: Real face detection library
   - Options: face-api.js, OpenCV, Python service
   - Input: JPEG buffer from ESP32-CAM
   - Output: Integer face count

## Testing Guide

### Manual Testing Flow

1. **Start Server**
   ```bash
   cd server
   npm run dev
   ```

2. **Scan Fingerprint**
   - Scan fingerprint on biometric device
   - Check server logs: "Session started: ..."

3. **Test IR Beam (Simulator)**
   ```bash
   # Test single crossing (should be OK)
   curl -X POST http://localhost:5000/api/ir-beam/test \
     -H "Content-Type: application/json" \
     -d '{"deviceId": "D4:E9:F4:BC:C7:B4", "count": 1}'

   # Test tailgating (2 crossings after 1 scan)
   curl -X POST http://localhost:5000/api/ir-beam/test \
     -H "Content-Type: application/json" \
     -d '{"deviceId": "D4:E9:F4:BC:C7:B4", "count": 2, "delay": 300}'
   ```

4. **Check Active Sessions**
   ```bash
   curl http://localhost:5000/api/ir-beam/sessions
   ```

### Expected Behavior

**Normal Entry (1 scan → 1 crossing):**
```
🟢 Session started: D4:E9:F4:BC:C7:B4_1708188800000 | User: user123
📸 Frame received: 2 faces detected
⚠️ WARNING: 2 faces detected, only 1 authorized
🚶 Beam crossing: IN | Passed: 1, Authorized: 1
🔵 Session closed: Status completed ✓
```

**Tailgating (1 scan → 2 crossings):**
```
🟢 Session started: D4:E9:F4:BC:C7:B4_1708188800000 | User: user123
📸 Frame received: 2 faces detected
🚶 Beam crossing: IN | Passed: 1, Authorized: 1
🚶 Beam crossing: IN | Passed: 2, Authorized: 1
🚨🚨🚨 TAILGATING ALARM: 2 people passed, only 1 authorized
📡 Sending TRIGGER_ALARM to ESP32
🚨 Buzzer activated
📊 Dashboard alert broadcast
```

## Dashboard Integration

### Socket.IO Events

```javascript
// Listen for tailgating events
socket.on('security:tailgating', (alarm) => {
  console.log('TAILGATING DETECTED:', alarm);
  // alarm = {
  //   sessionId,
  //   deviceId,
  //   authorized: 1,
  //   actualPassed: 2,
  //   tailgaters: 1,
  //   reason: "2 people passed, only 1 authorized"
  // }
});

// Listen for warnings
socket.on('security:warning', (warning) => {
  console.log('WARNING:', warning);
  // warning = {
  //   type: 'EXTRA_FACES',
  //   faceCount: 2,
  //   authorized: 1
  // }
});
```

## Future IR Sensor Integration

### ESP32 IR Sensor Code (Example)

```cpp
const int IR_BEAM_PIN = 14; // GPIO for IR sensor

void setup() {
  pinMode(IR_BEAM_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(IR_BEAM_PIN), onBeamBreak, FALLING);
}

void onBeamBreak() {
  // Send crossing event to server
  DynamicJsonDocument doc(256);
  doc["type"] = "IR_CROSSING";
  doc["deviceId"] = deviceMAC;
  doc["direction"] = "IN"; // or "OUT" based on beam direction
  doc["timestamp"] = millis();
  
  String json;
  serializeJson(doc, json);
  
  // Option 1: HTTP POST
  http.POST("/api/ir-beam/crossing", json);
  
  // Option 2: MQTT Publish
  mqttClient.publish("biometric/ir-beam", json.c_str());
}
```

### HTTP Integration (Recommended)

**Endpoint:** `POST /api/ir-beam/crossing`

**Request:**
```json
{
  "deviceId": "D4:E9:F4:BC:C7:B4",
  "direction": "IN",
  "timestamp": 1708188800000
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "D4:E9:F4:BC:C7:B4_1708188800000",
  "message": "Beam crossing recorded: IN"
}
```

## Performance Considerations

- **Session Duration:** 10 seconds (configurable)
- **Face Detection:** Should run <100ms per frame
- **Network Latency:** Camera timestamp used for accuracy
- **Alarm Response:** <200ms from detection to buzzer

## Troubleshooting

### No Alarm Triggered

1. ✅ Check session is active: `GET /api/ir-beam/sessions`
2. ✅ Verify beam crossing recorded: Check server logs
3. ✅ Ensure deviceId matches between fingerprint and IR sensor
4. ✅ Check WebSocket connection between server and ESP32-CAM

### False Alarms

1. ⚠️ Adjust face persistence threshold (currently 3 seconds)
2. ⚠️ Tune face detection model sensitivity
3. ⚠️ Add minimum confidence threshold for faces
4. ⚠️ Increase session duration if people walk slowly

### Session Not Starting

1. ✅ Check fingerprint scanner MQTT connection
2. ✅ Verify user exists and has access
3. ✅ Check device is registered and ACTIVE status
4. ✅ Review recognitionService logs

## Code Locations

```
server/
├── services/
│   ├── accessControl/
│   │   └── tailgatingDetection.js    # Core detection logic
│   ├── camera/
│   │   └── cameraStreamService.js    # Camera integration
│   └── pipelines/
│       └── recognitionService.js      # Fingerprint integration
└── routes/
    └── api/
        └── irBeamRoutes.js            # IR sensor API

ENTRY_NODE/src/
└── main.cpp                           # ESP32-CAM firmware
```

## Next Steps

1. **Implement Real Face Detection**
   - Replace placeholder in `cameraStreamService.detectFaces()`
   - Options: TensorFlow.js, face-api.js, or Python microservice

2. **Connect IR Beam Sensor**
   - Wire sensor to ESP32 GPIO
   - Add interrupt handler for beam break
   - Send POST request to `/api/ir-beam/crossing`

3. **Test Complete Flow**
   - Scan fingerprint → Camera detects faces → IR counts crossings
   - Verify alarm triggers correctly on tailgating

4. **Dashboard UI**
   - Add real-time tailgating alerts
   - Show active sessions
   - Display security log

## Contact

For questions or issues with the tailgating detection system, check:
- Server logs: `server/logs/`
- ESP32 serial monitor
- Active sessions API: `GET /api/ir-beam/sessions`
