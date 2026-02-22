# ESP32 Device Approval Flow

## Overview

When an ESP32 powers on, it registers with the server but remains in **PENDING** status until an admin approves it via the dashboard and assigns it to a cluster. This document explains the complete flow.

---

## Step-by-Step Flow

### 1. ESP32 Boot & Registration

**On power-up, ESP32:**

```cpp
void setup() {
  // Connect to WiFi
  connectWiFi();
  
  // Connect to MQTT
  mqttClient.setServer(MQTT_BROKER, 1883);
  mqttClient.setCallback(mqttCallback);
  connectMQTT();
  
  // Send registration (ONCE on boot)
  sendRegistration();
  
  // Load saved configuration (if previously approved)
  loadConfiguration();
}
```

**Registration message sent:**
```json
{
  "type": "DEVICE_REGISTER",
  "payload": {
    "deviceMAC": "68:FE:71:F8:31:A0",
    "deviceType": "ESP32",
    "firmwareVersion": "1.0.0",
    "capabilities": ["fingerprint", "relay"]
  },
  "timestamp": 5854
}
```

**Server Response:**
- ✅ Creates device with `status: 'PENDING'`
- ✅ Emits `device-pending-approval` event to dashboard
- ✅ Device appears in **Pending Approval** tab

---

### 2. Heartbeat While PENDING

**Every 30 seconds, ESP32 sends:**
```json
{
  "type": "HEARTBEAT",
  "deviceMAC": "68:FE:71:F8:31:A0",
  "payload": {
    "uptime": 30015,
    "wifiSignal": -46,
    "freeHeap": 252484,
    "fpSensorStatus": "OK",
    "relayStatus": "OK"
  },
  "timestamp": 30023
}
```

**Server Behavior:**
- ⏳ Only updates `lastHeartbeat` timestamp
- ⏳ Does NOT process health metrics
- ⏳ Does NOT emit dashboard events
- ⏳ Status remains **PENDING**
- ⏳ Logs: `⏳ PENDING approval (heartbeat received)`

**Why?** This lets admins see the device is **online and ready** while reviewing the approval request.

---

### 3. Admin Approval (Dashboard)

**Admin actions:**
1. Opens **Device Management** → **Pending Approval** tab
2. Sees device `68:FE:71:F8:31:A0` with last heartbeat timestamp
3. Clicks **Approve** button
4. Fills approval form:
   - **Cluster**: `ENTRANCE_A` (Main Entrance)
   - **Device Role**: `EXIT`
   - **Scanner ID**: `SCANNER-OUT`
   - **Location**: Building A - Main Door
5. Submits approval

**Server Actions:**
1. Updates database: `status: 'ACTIVE'`, assigns cluster/role/scanner
2. Emits `device-approved` Socket.io event to dashboard
3. **Sends MQTT command to ESP32:**

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

---

### 4. ESP32 Receives Approval

**ESP32 must handle this command:**

```cpp
// Global variables
String clusterID = "";
String deviceRole = "";
String scannerID = "";
bool isApproved = false;

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<512> doc;
  deserializeJson(doc, payload, length);
  
  const char* action = doc["action"];
  
  if (strcmp(action, "DEVICE_APPROVED") == 0) {
    // Store configuration permanently
    Preferences prefs;
    prefs.begin("biometric", false);
    
    JsonObject config = doc["config"];
    prefs.putString("clusterID", config["clusterID"] | "");
    prefs.putString("deviceRole", config["deviceRole"] | "");
    prefs.putString("scannerID", config["scannerID"] | "");
    prefs.putString("location", config["location"] | "");
    prefs.putBool("approved", true);
    
    prefs.end();
    
    // Load into runtime variables
    loadConfiguration();
    
    Serial.println("✓ Device approved and configured!");
    Serial.printf("  Cluster: %s\n", clusterID.c_str());
    Serial.printf("  Role: %s\n", deviceRole.c_str());
    Serial.printf("  Scanner: %s\n", scannerID.c_str());
    
    // Send immediate heartbeat with new config
    sendHeartbeat();
  }
  else if (strcmp(action, "ENROLL") == 0) {
    // Handle enrollment...
  }
  else if (strcmp(action, "UNLOCK_DOOR") == 0) {
    // Handle door unlock...
  }
}

void loadConfiguration() {
  Preferences prefs;
  prefs.begin("biometric", true);  // read-only
  
  isApproved = prefs.getBool("approved", false);
  clusterID = prefs.getString("clusterID", "");
  deviceRole = prefs.getString("deviceRole", "");
  scannerID = prefs.getString("scannerID", "");
  
  prefs.end();
  
  if (isApproved) {
    Serial.println("✓ Loaded saved configuration:");
    Serial.printf("  Cluster: %s\n", clusterID.c_str());
    Serial.printf("  Role: %s\n", deviceRole.c_str());
  } else {
    Serial.println("⏳ Device not yet approved");
  }
}
```

---

### 5. After Approval - Include Cluster Info

**From now on, ALL events must include cluster information:**

#### Heartbeat (every 30 seconds)
```json
{
  "type": "HEARTBEAT",
  "deviceMAC": "68:FE:71:F8:31:A0",
  "clusterID": "ENTRANCE_A",      // ← NOW INCLUDED
  "scannerID": "SCANNER-OUT",     // ← NOW INCLUDED  
  "payload": {
    "uptime": 60120,
    "wifiSignal": -45,
    "freeHeap": 252484,
    "fpSensorStatus": "OK",
    "relayStatus": "OK",
    "doorLockState": "LOCKED"
  },
  "timestamp": 60127
}
```

**Updated sendHeartbeat() function:**
```cpp
void sendHeartbeat() {
  StaticJsonDocument<512> doc;
  doc["type"] = "HEARTBEAT";
  doc["deviceMAC"] = deviceMAC;
  
  // Include cluster info if approved
  if (isApproved && clusterID.length() > 0) {
    doc["clusterID"] = clusterID;
    doc["scannerID"] = scannerID;
  }
  
  JsonObject payload = doc.createNestedObject("payload");
  payload["uptime"] = millis();
  payload["wifiSignal"] = WiFi.RSSI();
  payload["freeHeap"] = ESP.getFreeHeap();
  payload["fpSensorStatus"] = finger.verifyPassword() ? "OK" : "ERROR";
  payload["relayStatus"] = "OK";
  payload["doorLockState"] = digitalRead(RELAY_PIN) ? "UNLOCKED" : "LOCKED";
  payload["lastScanTime"] = lastScanTime;
  
  doc["timestamp"] = millis();
  
  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);
  mqttClient.publish("biometric/events", jsonBuffer);
}
```

#### Attendance Event (fingerprint scan)
```json
{
  "type": "ATTENDANCE",
  "deviceMAC": "68:FE:71:F8:31:A0",
  "clusterID": "ENTRANCE_A",      // ← NOW INCLUDED
  "scannerID": "SCANNER-OUT",     // ← NOW INCLUDED
  "deviceRole": "EXIT",           // ← NOW INCLUDED
  "payload": {
    "fingerprintId": 42,
    "confidence": 198,
    "direction": "EXIT"
  },
  "timestamp": 45678
}
```

---

## Server Behavior After Approval

### Heartbeats from ACTIVE Devices
- ✅ Processes full health metrics
- ✅ Emits `device-heartbeat` Socket.io event
- ✅ Updates cluster status
- ✅ Shows in dashboard **Cluster View**
- ✅ Real-time health monitoring active

### Attendance Events from ACTIVE Devices
- ✅ Validates fingerprint
- ✅ Records attendance
- ✅ Sends unlock command if authorized
- ✅ Updates occupancy tracking
- ✅ Sends WhatsApp notifications

### Blocked Actions While PENDING
- ❌ Heartbeats don't update health metrics
- ❌ Attendance events are rejected
- ❌ Device not shown in cluster view
- ❌ No real-time dashboard updates

---

## Security Benefits

1. **No Auto-Approval Exploit**: ESP32 cannot send cluster info and self-approve
2. **Admin Control**: Only authenticated admins can approve via dashboard
3. **Audit Trail**: `approvedBy` field tracks which admin approved each device
4. **Clean Data**: No health metrics or attendance from unapproved devices
5. **Visibility**: Admin sees device is online (via heartbeat timestamp) while reviewing

---

## Complete Arduino Example

```cpp
#include <Preferences.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// Configuration storage
Preferences prefs;
String clusterID = "";
String deviceRole = "";
String scannerID = "";
bool isApproved = false;

void setup() {
  Serial.begin(115200);
  
  // Load saved configuration
  loadConfiguration();
  
  // Connect WiFi & MQTT
  connectWiFi();
  connectMQTT();
  
  // Send registration
  sendRegistration();
}

void loop() {
  mqttClient.loop();
  
  // Send heartbeat every 30 seconds
  if (millis() - lastHeartbeat > 30000) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
}

void loadConfiguration() {
  prefs.begin("biometric", true);
  isApproved = prefs.getBool("approved", false);
  clusterID = prefs.getString("clusterID", "");
  deviceRole = prefs.getString("deviceRole", "");
  scannerID = prefs.getString("scannerID", "");
  prefs.end();
  
  if (isApproved) {
    Serial.println("✓ Device previously approved");
    Serial.printf("  Cluster: %s | Role: %s | Scanner: %s\n", 
                  clusterID.c_str(), deviceRole.c_str(), scannerID.c_str());
  } else {
    Serial.println("⏳ Awaiting admin approval");
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<512> doc;
  deserializeJson(doc, payload, length);
  
  if (strcmp(doc["action"], "DEVICE_APPROVED") == 0) {
    prefs.begin("biometric", false);
    JsonObject config = doc["config"];
    prefs.putString("clusterID", config["clusterID"] | "");
    prefs.putString("deviceRole", config["deviceRole"] | "");
    prefs.putString("scannerID", config["scannerID"] | "");
    prefs.putBool("approved", true);
    prefs.end();
    
    loadConfiguration();
    Serial.println("✓ Device approved!");
    sendHeartbeat();  // Immediate heartbeat with cluster info
  }
}

void sendHeartbeat() {
  StaticJsonDocument<512> doc;
  doc["type"] = "HEARTBEAT";
  doc["deviceMAC"] = WiFi.macAddress();
  
  if (isApproved) {
    doc["clusterID"] = clusterID;
    doc["scannerID"] = scannerID;
  }
  
  JsonObject payload = doc.createNestedObject("payload");
  payload["uptime"] = millis();
  payload["wifiSignal"] = WiFi.RSSI();
  payload["freeHeap"] = ESP.getFreeHeap();
  payload["fpSensorStatus"] = "OK";
  payload["relayStatus"] = "OK";
  
  doc["timestamp"] = millis();
  
  char buffer[512];
  serializeJson(doc, buffer);
  mqttClient.publish("biometric/events", buffer);
}
```

---

## Testing Checklist

- [ ] ESP32 boots and sends DEVICE_REGISTER
- [ ] Device appears in dashboard **Pending Approval** tab
- [ ] ESP32 sends heartbeat every 30 seconds while PENDING
- [ ] Server logs show: `⏳ PENDING approval (heartbeat received)`
- [ ] Admin approves device via dashboard
- [ ] ESP32 receives DEVICE_APPROVED command
- [ ] ESP32 stores config in preferences
- [ ] ESP32 sends immediate heartbeat with cluster info
- [ ] Device appears in dashboard **Cluster View**
- [ ] Server processes health metrics from ACTIVE device
- [ ] ESP32 survives reboot and loads saved configuration

---

## Troubleshooting

### Device not appearing in Pending Approval
- Check server logs for `[MQTT Bridge] ⬇️  Event: DEVICE_REGISTER`
- Verify MQTT broker listening on port 1883: `netstat -ano | findstr "1883"`
- Reset ESP32 to trigger fresh registration

### ESP32 not receiving DEVICE_APPROVED command
- Check ESP32 subscribed to `biometric/commands` topic
- Verify mqttCallback is registered: `mqttClient.setCallback(mqttCallback)`
- Check server logs for `[MQTT Bridge] ✓ Command Sent: DEVICE_APPROVED`

### Configuration not persisting after reboot
- Ensure using `Preferences.h` not EEPROM (deprecated)
- Check `prefs.begin("biometric", false)` for write mode
- Verify `prefs.end()` is called after writing
- Load config in `setup()` after preferences are initialized

---

## Next Steps

1. Update your ESP32 code to handle `DEVICE_APPROVED` command
2. Add `loadConfiguration()` in `setup()`
3. Update `sendHeartbeat()` to include cluster info when approved
4. Update `sendAttendance()` to include cluster info when approved
5. Reset ESP32 to test full approval flow
