# IoT Biometric Tailgating Detection System - Feature Gap Analysis

**Date:** February 17, 2026  
**System:** Entry/Exit Cluster with Tailgating Detection  
**Status:** ⚠️ Incomplete - Critical Components Missing

---

## 🏗️ System Architecture Overview

### Current Setup
```
┌──────────────────────────────────────────────────────────────┐
│                         CLUSTER                               │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────┐           ┌──────────────────┐          │
│  │   ENTRY NODE    │           │    EXIT NODE     │          │
│  │   (ESP32-CAM)   │───────────│    (ESP32)       │          │
│  ├─────────────────┤           ├──────────────────┤          │
│  │ ✅ Camera       │           │ ✅ Fingerprint   │          │
│  │ ✅ Buzzer       │           │ ✅ Door Relay    │          │
│  │ ❌ Fingerprint  │           │ ❌ Buzzer        │          │
│  │ ❌ IR Beam      │           │ ❌ IR Beam       │          │
│  └─────────────────┘           └──────────────────┘          │
│         │                              │                      │
│         │ WebSocket                    │ MQTT                │
│         └──────────────┬───────────────┘                     │
│                        │                                      │
└────────────────────────┼──────────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │ SERVER  │
                    │ Node.js │
                    └─────────┘
```

### Intended Flow (Not Fully Implemented)
```
1. User approaches ENTRY
2. User scans fingerprint on ENTRY node → Server recognizes → Starts session
3. ENTRY camera detects faces → Server counts faces
4. User passes through IR beam → Server counts crossings
5. IF crossings > scans → ALARM on ENTRY & EXIT buzzers
6. Server sends UNLOCK_DOOR to EXIT node
7. User enters
```

---

## 📋 EXIT NODE (ESP32 - Biometrics Attendance System)

### ✅ Implemented Features
| Feature             | Status | Details                                                 |
| ------------------- | ------ | ------------------------------------------------------- |
| Fingerprint Scanner | ✅      | Adafruit_Fingerprint on Serial2 (RX=16, TX=17)          |
| Door Lock Relay     | ✅      | GPIO 5 (HIGH=unlock, LOW=lock)                          |
| MQTT Communication  | ✅      | Topics: biometric/events, biometric/commands            |
| Cluster Management  | ✅      | clusterID, scannerID, deviceRole stored                 |
| Template Sync       | ✅      | ENROLL_WITH_TEMPLATE, INSTALL_TEMPLATE, DELETE_TEMPLATE |
| Multi-color LED     | ✅      | GPIO 26=RED, 27=GREEN, 14=BLUE                          |
| WiFi Manager        | ✅      | Reset button on GPIO 4                                  |
| Registration        | ✅      | Device approval system with server                      |
| Heartbeat           | ✅      | Status monitoring every 1.5s                            |
| Door Control        | ✅      | UNLOCK_DOOR command handler, auto-lock timer            |

### ❌ Missing Features (CRITICAL)

#### 1. **Buzzer/Alarm System** 🔴 HIGH PRIORITY
**Problem:**  
- No buzzer pin defined in firmware
- EXIT node can't sound alarm during tailgating
- Only LED feedback available

**Solution:**
```cpp
// Add to EXIT NODE main.cpp
const int BUZZER_PIN = 13; // Or any available GPIO

void setup() {
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
}

// Add MQTT command handler
void handleTriggerAlarm() {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(3000); // 3 second alarm
  digitalWrite(BUZZER_PIN, LOW);
}
```

**Hardware Needed:**
- Active buzzer module (3.3V compatible)
- GPIO 13 (or any free pin)

---

#### 2. **IR Beam Sensor** 🔴 HIGH PRIORITY
**Problem:**  
- No IR sensor hardware connected
- Can't physically count people passing through
- Tailgating detection **cannot work** without this

**Solution:**
```cpp
// Add to EXIT NODE main.cpp
const int IR_BEAM_PIN = 15; // Available GPIO
volatile bool beamBroken = false;

void IRAM_ATTR onBeamBreak() {
  beamBroken = true;
}

void setup() {
  pinMode(IR_BEAM_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(IR_BEAM_PIN), onBeamBreak, FALLING);
}

void loop() {
  if (beamBroken) {
    publishBeamCrossing("EXIT", "IN"); // or "OUT" based on direction
    beamBroken = false;
  }
}

void publishBeamCrossing(String deviceRole, String direction) {
  DynamicJsonDocument doc(256);
  doc["type"] = "IR_CROSSING";
  doc["deviceId"] = deviceMAC;
  doc["clusterID"] = clusterID;
  doc["role"] = deviceRole;
  doc["direction"] = direction;
  doc["timestamp"] = millis();
  
  String json;
  serializeJson(doc, json);
  mqttClient.publish("biometric/events", json.c_str());
}
```

**Hardware Needed:**
- IR beam sensor module (transmitter + receiver)
- GPIO 15 for sensor input
- Mount at doorway height (~1m from ground)

---

#### 3. **Cluster-Wide Alarm Broadcasting**
**Problem:**  
- EXIT node doesn't receive tailgating alerts from ENTRY
- No coordination between cluster nodes

**Solution:**
Add MQTT subscription to `biometric/alerts` topic:
```cpp
// In mqttCallback()
if (topic == "biometric/alerts") {
  String alertType = doc["type"];
  if (alertType == "TAILGATING" && doc["clusterID"] == clusterID) {
    triggerAlarm(doc["reason"]);
  }
}
```

---

## 📋 ENTRY NODE (ESP32-CAM - ENTRY_NODE)

### ✅ Implemented Features
| Feature                 | Status | Details                            |
| ----------------------- | ------ | ---------------------------------- |
| ESP32-CAM Streaming     | ✅      | VGA 640×480 @ 10 FPS               |
| Buzzer/Alarm            | ✅      | GPIO 12                            |
| WebSocket Communication | ✅      | ws://SERVER:3000/camera/stream     |
| HTTP Camera Server      | ✅      | Port 80: /stream, /snapshot        |
| Alarm Control           | ✅      | TRIGGER_ALARM, STOP_ALARM handlers |
| Cluster Config          | ✅      | clusterID, cameraID stored         |
| Registration            | ✅      | Device capabilities transmission   |
| Heartbeat               | ✅      | Uptime, RSSI, FPS, heap stats      |
| WiFi Manager            | ✅      | Auto-connect portal                |

### ❌ Missing Features (CRITICAL)

#### 1. **Fingerprint Scanner** 🔴 HIGH PRIORITY
**Problem:**  
- User mentioned ENTRY node has fingerprint scanner
- **NOT IMPLEMENTED IN CODE**
- No library in platformio.ini
- No Serial2 initialization

**Solution:**

**Step 1: Add library to platformio.ini**
```ini
lib_deps = 
    ...existing libraries...
    adafruit/Adafruit Fingerprint Sensor Library @ ^2.1.0
```

**Step 2: Add to main.cpp**
```cpp
#include <Adafruit_Fingerprint.h>

// Use different pins than EXIT node
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fpSerial);
const int FP_RX = 14; // Or any available GPIO
const int FP_TX = 15; // Or any available GPIO

void setup() {
  fpSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
  finger.begin(57600);
  
  if (finger.verifyPassword()) {
    Serial.println("✅ Fingerprint sensor found!");
  } else {
    Serial.println("❌ Fingerprint sensor not found");
  }
}

void loop() {
  checkForFingerprint();
}

void checkForFingerprint() {
  uint8_t result = finger.getImage();
  if (result != FINGERPRINT_OK) return;
  
  result = finger.image2Tz();
  if (result != FINGERPRINT_OK) return;
  
  result = finger.fingerFastSearch();
  if (result == FINGERPRINT_OK) {
    publishFingerprintScan(finger.fingerID, finger.confidence);
  }
}

void publishFingerprintScan(uint16_t id, uint16_t confidence) {
  // Send via WebSocket or MQTT
  DynamicJsonDocument doc(512);
  doc["type"] = "FINGERPRINT_SCAN";
  doc["deviceId"] = deviceMAC;
  doc["clusterID"] = clusterID;
  doc["role"] = "ENTRY";
  doc["fingerprintId"] = id;
  doc["confidence"] = confidence;
  doc["timestamp"] = millis();
  
  String json;
  serializeJson(doc, json);
  webSocket.sendTXT(json); // Or use MQTT if added
}
```

**Hardware Wiring:**
- FP Scanner VCC → 3.3V
- FP Scanner GND → GND
- FP Scanner TX → GPIO 14 (ESP32 RX)
- FP Scanner RX → GPIO 15 (ESP32 TX)

---

#### 2. **IR Beam Sensor** 🔴 HIGH PRIORITY
**Problem:**  
- Same as EXIT node - no IR sensor
- Can't count people entering

**Solution:**
Same implementation as EXIT node, but use different GPIO:
```cpp
const int IR_BEAM_PIN = 13; // Different from EXIT
```

**Hardware Needed:**
- IR beam sensor module
- Mount opposite side of doorway from EXIT sensor

---

#### 3. **MQTT Client** 🟡 MEDIUM PRIORITY
**Problem:**  
- Only has WebSocket (for camera)
- Can't subscribe to cluster commands directly
- Must relay through server

**Solution:**

**Add to platformio.ini:**
```ini
lib_deps = 
    ...
    knolleary/PubSubClient @ ^2.8
```

**Add to main.cpp:**
```cpp
#include <PubSubClient.h>

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

void connectMQTT() {
  mqttClient.setServer(MQTT_BROKER, 1883);
  mqttClient.setCallback(mqttCallback);
  
  while (!mqttClient.connected()) {
    if (mqttClient.connect(deviceMAC.c_str(), MQTT_USER, MQTT_PASSWORD)) {
      mqttClient.subscribe("biometric/commands");
      mqttClient.subscribe("biometric/alerts");
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  DynamicJsonDocument doc(1024);
  deserializeJson(doc, payload, length);
  
  String type = doc["type"];
  
  if (type == "TRIGGER_ALARM") {
    triggerAlarm();
  } else if (type == "CLUSTER_SYNC") {
    // Handle cluster coordination
  }
}

void loop() {
  mqttClient.loop();
  webSocket.loop();
  // ... rest of code
}
```

**Benefits:**
- Direct cluster communication
- Faster response time
- Can receive alerts without server relay

---

## 📋 SERVER (Node.js)

### ✅ Implemented Features
| Feature                      | Status | Details                                  |
| ---------------------------- | ------ | ---------------------------------------- |
| Tailgating Detection Service | ✅      | Session tracking, 10-second windows      |
| MQTT Bridge                  | ✅      | ESP32 ↔ RabbitMQ integration             |
| WebSocket Camera Server      | ✅      | Port 3000                                |
| Recognition Service          | ✅      | addFingerprintScan() integration         |
| IR Beam HTTP API             | ✅      | /api/ir-beam/crossing, /api/ir-beam/test |
| Cluster Management           | ✅      | Cluster model, device grouping           |
| Device Registration          | ✅      | Approval workflow                        |
| Template Sync                | ✅      | Global fingerprint sharing               |
| Socket.IO Events             | ✅      | security:tailgating, security:extraFaces |
| Event Correlation            | ✅      | Fingerprints + faces + beams             |
| Door Unlock                  | ✅      | UNLOCK_DOOR MQTT command                 |
| Alarm Trigger                | ✅      | TRIGGER_ALARM WebSocket                  |

### ❌ Missing Features (CRITICAL)

#### 1. **Real Face Detection Model** 🔴 HIGH PRIORITY
**Problem:**  
- `detectFaces()` is placeholder returning `Math.floor(Math.random() * 3)`
- Can't actually count faces
- Core functionality broken

**Current Code (server/services/camera/cameraStreamService.js:163-167):**
```javascript
async detectFaces(frameData) {
    // TODO: Integrate face detection library
    return Math.floor(Math.random() * 3); // 0, 1, or 2 faces
}
```

**Solution Option A: face-api.js (Pure JavaScript)**
```javascript
import * as faceapi from 'face-api.js';
import { Canvas, Image, ImageData } from 'canvas';
import * as tf from '@tensorflow/tfjs-node';

// Monkey patch for face-api.js
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

class FaceDetectionService {
    constructor() {
        this.modelsLoaded = false;
    }

    async loadModels() {
        const MODEL_PATH = './models';
        await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH);
        this.modelsLoaded = true;
        console.log('✅ Face detection models loaded');
    }

    async detectFaces(jpegBuffer) {
        if (!this.modelsLoaded) {
            await this.loadModels();
        }

        // Convert JPEG buffer to tensor
        const img = await Image.from(jpegBuffer);
        
        // Detect faces
        const detections = await faceapi.detectAllFaces(img);
        
        return detections.length;
    }
}

export default new FaceDetectionService();
```

**Installation:**
```bash
cd server
npm install face-api.js canvas @tensorflow/tfjs-node
```

**Download models:**
```bash
mkdir server/models
cd server/models
# Download from: https://github.com/justadudewhohacks/face-api.js-models
# Download: ssd_mobilenetv1_model-weights_manifest.json, ssd_mobilenetv1_model-shard1
```

**Update cameraStreamService.js:**
```javascript
import faceDetection from '../ml/faceDetection.js';

async detectFaces(frameData) {
    try {
        const count = await faceDetection.detectFaces(frameData);
        return count;
    } catch (error) {
        console.error('Face detection error:', error);
        return 0; // Fail safe - assume no faces on error
    }
}
```

**Performance Target:**
- <100ms per frame
- 10 FPS camera = 100ms budget per frame
- Use GPU if available with `@tensorflow/tfjs-node-gpu`

---

**Solution Option B: Python Microservice (OpenCV)**

Better for performance-critical applications.

**Create server/python/face_detector.py:**
```python
import cv2
import numpy as np
from flask import Flask, request, jsonify

app = Flask(__name__)

# Load Haar Cascade
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

@app.route('/detect', methods=['POST'])
def detect_faces():
    # Get JPEG from request
    jpeg_data = request.data
    nparr = np.frombuffer(jpeg_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Detect faces
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5)
    
    return jsonify({'faceCount': len(faces)})

if __name__ == '__main__':
    app.run(port=5001)
```

**Update Node.js cameraStreamService.js:**
```javascript
import axios from 'axios';

async detectFaces(frameData) {
    try {
        const response = await axios.post('http://localhost:5001/detect', frameData, {
            headers: { 'Content-Type': 'image/jpeg' },
            timeout: 100 // 100ms timeout
        });
        return response.data.faceCount;
    } catch (error) {
        console.error('Face detection error:', error);
        return 0;
    }
}
```

**Start Python service:**
```bash
pip install flask opencv-python numpy
python server/python/face_detector.py
```

---

#### 2. **MQTT IR Beam Handler** 🟡 MEDIUM PRIORITY
**Problem:**  
- IR beam API exists (`/api/ir-beam/crossing`) but requires manual HTTP POST
- No MQTT topic subscription for automatic IR events from ESP32

**Solution:**

**Add to server/services/mqtt/mqttBridgeService.js:**
```javascript
// In connect() method, add subscription
this.client.subscribe('biometric/ir-beam', (err) => {
    if (err) {
        console.error('❌ Failed to subscribe to IR beam topic:', err);
    } else {
        console.log('✓ Subscribed to MQTT topic: biometric/ir-beam');
    }
});

// In handleMessage() method, add case
case 'IR_CROSSING':
    await tailgatingDetection.recordBeamCrossing(
        event.deviceId,
        event.direction,
        event.timestamp || Date.now()
    );
    break;
```

---

#### 3. **Cluster-Based Door Unlock** 🟡 MEDIUM PRIORITY
**Problem:**  
- ENTRY node fingerprint scan doesn't automatically trigger EXIT door unlock
- Manual coordination required

**Solution:**

**Update server/services/pipelines/recognitionService.js:**
```javascript
// After line: const sessionId = tailgatingDetection.addFingerprintScan(...)

// Check if this is ENTRY node and door control is on EXIT
const device = await Device.findOne({ deviceMAC });
if (device && device.deviceRole === 'ENTRY') {
    // Find cluster and EXIT node
    const cluster = await Cluster.findOne({ 
        clusterID: device.clusterID 
    });
    
    if (cluster && cluster.doorControlDevice) {
        // Send unlock command to EXIT node
        const unlockCommand = {
            type: 'UNLOCK_DOOR',
            deviceMAC: cluster.doorControlDevice,
            duration: cluster.unlockDuration || 5000,
            authorizedBy: user.username,
            sourceDevice: deviceMAC,
            sessionId: sessionId,
            timestamp: Date.now()
        };
        
        mqttClient.publish('biometric/commands', JSON.stringify(unlockCommand));
        console.log(`🔓 UNLOCK command sent to EXIT node: ${cluster.doorControlDevice}`);
    }
}
```

---

## 🔧 Hardware Requirements Summary

### EXIT NODE Hardware Additions
| Item           | Purpose          | GPIO    | Cost | Priority |
| -------------- | ---------------- | ------- | ---- | -------- |
| Active Buzzer  | Tailgating alarm | GPIO 13 | ~$1  | 🔴 HIGH   |
| IR Beam Sensor | People counting  | GPIO 15 | ~$5  | 🔴 HIGH   |

### ENTRY NODE Hardware Additions
| Item                | Purpose             | GPIO         | Cost | Priority |
| ------------------- | ------------------- | ------------ | ---- | -------- |
| Fingerprint Scanner | User authentication | RX=14, TX=15 | ~$10 | 🔴 HIGH   |
| IR Beam Sensor      | People counting     | GPIO 13      | ~$5  | 🔴 HIGH   |

**Total Hardware Cost: ~$20**

---

## 🎯 Implementation Priority

### Phase 1: Critical (Week 1) 🔴
1. **Add IR Beam Sensors** to both nodes
   - Block: System cannot detect tailgating without physical sensors
   - Effort: 4 hours (hardware + firmware)
   
2. **Implement Real Face Detection**
   - Block: Current placeholder returns random numbers
   - Effort: 8 hours (model integration + testing)
   
3. **Add Fingerprint Scanner to ENTRY Node**
   - Block: User claims it exists but not in code
   - Effort: 4 hours (library + firmware)

### Phase 2: Important (Week 2) 🟡
4. **Add MQTT to ENTRY Node**
   - Benefit: Cluster coordination without server relay
   - Effort: 2 hours
   
5. **Add Buzzer to EXIT Node**
   - Benefit: Dual-alarm system (ENTRY + EXIT)
   - Effort: 1 hour
   
6. **Cluster-Based Door Unlock**
   - Benefit: Automatic door unlock on ENTRY scan
   - Effort: 2 hours

### Phase 3: Enhanced (Week 3) 🟠
7. **MQTT IR Beam Auto-Handler**
   - Benefit: Automatic processing without HTTP POST
   - Effort: 1 hour
   
8. **ESP-NOW Direct Communication**
   - Benefit: Ultra-low latency (<10ms) cluster comms
   - Effort: 6 hours

---

## 🧪 Testing Checklist

### Unit Tests
- [ ] IR sensor interrupts fire correctly
- [ ] Face detection returns accurate counts (test with known images)
- [ ] Fingerprint scanner reads and transmits
- [ ] MQTT messages publish/receive on both nodes
- [ ] WebSocket camera frames received by server

### Integration Tests
- [ ] ENTRY fingerprint scan → Server session starts
- [ ] Camera faces detected → recordFaceDetection() called
- [ ] IR beam break → recordBeamCrossing() called
- [ ] Server correlation: scans=1, faces=2, beams=2 → ALARM

### End-to-End Scenarios
- [ ] **Normal Entry:** 1 scan → 1 face → 1 beam → Door unlocks → LOG
- [ ] **Tailgating:** 1 scan → 2 faces → 2 beams → ALARM + Log
- [ ] **Multiple Auth:** 2 scans → 2 faces → 2 beams → Door unlocks → LOG
- [ ] **Unauthorized:** 0 scans → 1 beam → IMMEDIATE ALARM
- [ ] **Cluster Coordination:** ENTRY scan → EXIT door unlocks <2s
- [ ] **Dual Alarm:** Tailgating → ENTRY buzzer + EXIT buzzer sound

---

## 📊 Current System Status

```
Overall Completion: 65%

EXIT NODE:   ████████░░ 80% (Missing: Buzzer, IR Sensor)
ENTRY NODE:  ████░░░░░░ 40% (Missing: Fingerprint, IR Sensor, MQTT)
SERVER:      ███████░░░ 70% (Missing: Real Face Detection, MQTT IR handler)
INTEGRATION: ████░░░░░░ 40% (Missing: Cluster unlock, dual alarms)

BLOCKER: IR BEAM SENSORS (0% complete)
         Without this hardware, tailgating detection CANNOT function.
```

---

## 🚀 Quick Start Implementation Guide

### 1. Add IR Beam Sensors (4 hours)

**Shopping List:**
- 2x IR beam sensor modules (transmitter + receiver pairs)
- Jumper wires

**EXIT Node:**
```cpp
// Add to main.cpp after existing pin definitions
const int IR_BEAM_PIN = 15;
volatile unsigned long lastBeamBreak = 0;

void IRAM_ATTR onBeamBreak() {
  // Debounce - ignore if < 500ms since last break
  if (millis() - lastBeamBreak > 500) {
    lastBeamBreak = millis();
    // Set flag to publish in main loop (not in ISR)
    beamBrokenFlag = true;
  }
}

void setup() {
  pinMode(IR_BEAM_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(IR_BEAM_PIN), onBeamBreak, FALLING);
}

void loop() {
  if (beamBrokenFlag) {
    publishBeamCrossing("EXIT", "IN");
    beamBrokenFlag = false;
  }
}

void publishBeamCrossing(String role, String direction) {
  DynamicJsonDocument doc(256);
  doc["type"] = "IR_CROSSING";
  doc["deviceId"] = deviceMAC;
  doc["clusterID"] = clusterID;
  doc["role"] = role;
  doc["direction"] = direction;
  doc["timestamp"] = millis();
  
  String json;
  serializeJson(doc, json);
  mqttClient.publish("biometric/events", json.c_str());
  
  Serial.printf("📡 IR Beam: %s %s\n", role.c_str(), direction.c_str());
}
```

**ENTRY Node:**
Same code, but use `GPIO 13` and `role = "ENTRY"`.

**Server:**
Already implemented! Just need ESP32 to send events.

---

### 2. Integrate Face Detection (8 hours)

**Install Dependencies:**
```bash
cd server
npm install face-api.js canvas @tensorflow/tfjs-node
```

**Download Models:**
```bash
mkdir -p server/models
cd server/models
wget https://github.com/justadudewhohacks/face-api.js-models/raw/master/ssd_mobilenetv1_model-weights_manifest.json
wget https://github.com/justadudewhohacks/face-api.js-models/raw/master/ssd_mobilenetv1_model-shard1
```

**Create Face Detection Service (server/services/ml/faceDetection.js):**
```javascript
import * as faceapi from 'face-api.js';
import { Canvas, Image } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

faceapi.env.monkeyPatch({ Canvas, Image });

class FaceDetectionService {
    constructor() {
        this.modelsLoaded = false;
    }

    async loadModels() {
        try {
            const modelPath = path.join(__dirname, '../../models');
            await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
            this.modelsLoaded = true;
            console.log('✅ Face detection models loaded from:', modelPath);
        } catch (error) {
            console.error('❌ Failed to load face detection models:', error);
            throw error;
        }
    }

    async detectFaces(jpegBuffer) {
        if (!this.modelsLoaded) {
            await this.loadModels();
        }

        try {
            const img = await Image.from(jpegBuffer);
            const detections = await faceapi.detectAllFaces(img);
            return detections.length;
        } catch (error) {
            console.error('Face detection error:', error);
            return 0; // Fail-safe
        }
    }
}

export default new FaceDetectionService();
```

**Update cameraStreamService.js:**
```javascript
import faceDetection from '../ml/faceDetection.js';

async detectFaces(frameData) {
    const count = await faceDetection.detectFaces(frameData);
    console.log(`🔍 Detected ${count} face(s)`);
    return count;
}
```

**Test:**
```bash
npm run dev
# Watch logs for "✅ Face detection models loaded"
# Point camera at people
# Should see "🔍 Detected X face(s)" in logs
```

---

### 3. Add Fingerprint to ENTRY Node (4 hours)

**Update platformio.ini:**
```ini
[env:esp32cam]
lib_deps = 
    ...existing...
    adafruit/Adafruit Fingerprint Sensor Library @ ^2.1.0
```

**Add to main.cpp:**
```cpp
#include <Adafruit_Fingerprint.h>

HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fpSerial);
const int FP_RX = 14;
const int FP_TX = 15;

void setup() {
  // After camera init
  fpSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
  finger.begin(57600);
  
  if (finger.verifyPassword()) {
    Serial.println("✅ Fingerprint sensor detected");
  }
}

void loop() {
  webSocket.loop();
  sendCameraFrame();
  checkForFingerprint(); // Add this
}

void checkForFingerprint() {
  if (finger.getImage() != FINGERPRINT_OK) return;
  if (finger.image2Tz() != FINGERPRINT_OK) return;
  if (finger.fingerFastSearch() == FINGERPRINT_OK) {
    sendFingerprintScan(finger.fingerID, finger.confidence);
  }
}

void sendFingerprintScan(uint16_t id, uint16_t conf) {
  DynamicJsonDocument doc(512);
  doc["type"] = "FINGERPRINT_SCAN";
  doc["deviceId"] = deviceMAC;
  doc["clusterID"] = clusterID;
  doc["role"] = "ENTRY";
  doc["fingerprintId"] = id;
  doc["confidence"] = conf;
  doc["timestamp"] = millis();
  
  String json;
  serializeJson(doc, json);
  webSocket.sendTXT(json);
  
  Serial.printf("👆 Fingerprint: ID=%d, Conf=%d\n", id, conf);
}
```

**Wire Fingerprint Scanner:**
```
FP VCC → 3.3V
FP GND → GND
FP TX  → GPIO 14 (ESP32 RX)
FP RX  → GPIO 15 (ESP32 TX)
```

**Upload & Test:**
```bash
cd ENTRY_NODE
platformio run --target upload
platformio device monitor
# Place finger on scanner
# Should see: "👆 Fingerprint: ID=X, Conf=Y"
```

---

## 📞 Support & Troubleshooting

### Common Issues

**"IR sensor not detecting"**
- Check wiring (VCC, GND, Signal)
- Test with multimeter: Signal pin should toggle between HIGH/LOW
- Add debug LED: `digitalWrite(LED_PIN, digitalRead(IR_BEAM_PIN))`

**"Face detection too slow"**
- Check GPU availability: `@tensorflow/tfjs-node-gpu`
- Reduce frame rate on ESP32: `config.frame_size = FRAMESIZE_CIF`
- Use Python/OpenCV instead of face-api.js

**"ENTRY fingerprint not working"**
- Verify Serial2 pins: Some GPIOs are camera-reserved
- Use GPIOs: 12, 13, 14, 15 (safe on ESP32-CAM)
- Check baud rate: 57600 (not 9600)

**"Cluster nodes not syncing"**
- Verify both nodes have same `clusterID`
- Check MQTT topics: `mosquitto_sub -t 'biometric/#' -h SERVER_IP`
- Ensure firewall allows port 1883

---

## 📝 Deployment Checklist

Before going to production:

- [ ] **Hardware Installation**
  - [ ] IR sensors mounted at doorway (1m height)
  - [ ] Fingerprint scanners accessible to users
  - [ ] Buzzers audible from both sides of door
  - [ ] Door relay wired correctly (NO/NC check)

- [ ] **Firmware Upload**
  - [ ] EXIT node updated with buzzer & IR code
  - [ ] ENTRY node updated with fingerprint & IR code
  - [ ] Both nodes configured with correct cluster ID
  - [ ] Test each device individually before integration

- [ ] **Server Configuration**
  - [ ] Face detection models downloaded
  - [ ] MQTT broker running (`mosquitto -v`)
  - [ ] Node.js server started (`npm run dev`)
  - [ ] RabbitMQ running (`rabbitmq-server`)

- [ ] **Testing**
  - [ ] Single user entry (normal case)
  - [ ] Tailgating attempt (2 people, 1 scan)
  - [ ] Unauthorized entry (no scan)
  - [ ] Cluster coordination (ENTRY → EXIT unlock)
  - [ ] Alarm system (both buzzers sound)

- [ ] **Monitoring**
  - [ ] Dashboard displaying real-time events
  - [ ] Logs being written correctly
  - [ ] Alerts configured (email/SMS for security events)

---

## 🎓 Summary

**Current State:** System is 65% complete. Core logic is implemented but **critical hardware (IR sensors)** and **face detection model** are missing.

**Blocking Issues:**
1. 🔴 IR beam sensors not installed (CRITICAL)
2. 🔴 Real face detection not implemented (CRITICAL)
3. 🔴 ENTRY fingerprint scanner not in firmware (CRITICAL)

**Estimated Time to Complete:** 16-20 hours
- IR Sensors: 4 hours
- Face Detection: 8 hours  
- ENTRY Fingerprint: 4 hours
- Testing & Integration: 4 hours

**Next Immediate Step:** Order IR beam sensor modules (~$10, 2-day shipping) and wire to GPIO 15 (EXIT) and GPIO 13 (ENTRY).

---

**Document Version:** 1.0  
**Last Updated:** February 17, 2026  
**Status:** ⚠️ SYSTEM INCOMPLETE - CRITICAL COMPONENTS MISSING
