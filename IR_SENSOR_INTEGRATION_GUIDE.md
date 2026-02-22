# IR SENSOR WIRING & INTEGRATION GUIDE

## 📷 Your Sensors
Based on your photo, you have **IR obstacle/beam sensors** with 3 wires:
- **RED wire** = VCC (Power)
- **BLACK wire** = GND (Ground)  
- **YELLOW/ORANGE wire** = OUT (Signal)

## 🔌 Wiring Connections

### EXIT NODE (ESP32 - Biometrics Attendance System)

```
IR Sensor          ESP32 Board
─────────────────────────────
RED (VCC)     →    3.3V pin
BLACK (GND)   →    GND pin
YELLOW (OUT)  →    GPIO 15
```

**Physical Arrangement:**
```
              DOORWAY
        ┌───────────────────┐
ENTRY   │                   │   EXIT
SIDE    │                   │   SIDE
        │                   │
        │   ← Direction →   │
        │                   │
        └───────────────────┘
```

Mount IR sensor at **EXIT side** of doorway, ~1 meter from ground.

---

### ENTRY NODE (ESP32-CAM)

```
IR Sensor          ESP32-CAM
─────────────────────────────
RED (VCC)     →    3.3V pin
BLACK (GND)   →    GND pin
YELLOW (OUT)  →    GPIO 14
```

Mount IR sensor at **ENTRY side** of doorway, ~1 meter from ground.

---

## ⚠️ IMPORTANT: Check Sensor Voltage

Before connecting, check if your sensors are 3.3V or 5V:

1. **Look at sensor marking** - Should say "3.3V-5V" or similar
2. **Test with multimeter**:
   - Connect VCC to 3.3V and GND
   - Measure voltage on OUT pin
   - If > 3.6V, you need voltage divider!

### If Sensor Outputs 5V (Protection Circuit):

```
                    IR Sensor OUT (Yellow wire)
                             │
                             │
                           ┌─┴─┐
                           │   │  2.2kΩ resistor
                           │   │
                           └─┬─┘
                             │
                             ├─────→ ESP32 GPIO
                             │
                           ┌─┴─┐
                           │   │  3.3kΩ resistor
                           │   │
                           └─┬─┘
                             │
                            GND
```

**Most modern sensors work with 3.3V directly** - try without resistors first!

---

## 🧪 TESTING PROCEDURE

### Step 1: Test ONE Sensor First

1. **Wire one IR sensor to EXIT NODE** (GPIO 15)
2. **Upload test program**: Use `test/ir_sensor_test.cpp`
3. **Open Serial Monitor** (115200 baud)
4. **Wave your hand** in front of sensor
5. **Watch for**:
   - Built-in LED lights up when hand detected
   - Serial output shows "OBJECT DETECTED"

### Step 2: Understand Sensor Behavior

Your IR sensors work in one of two ways:

**Type A: Reflective Sensor (Single Module)**
```
   IR LED ))) →  ← ((( Photodiode
              ↓
         [Hand blocks]
              ↓
      Signal goes LOW
```
- Detection range: 2-30cm
- Used for obstacle detection
- Single module has both transmitter and receiver

**Type B: Beam-Break Sensor (Two Modules)**
```
Transmitter )))  ~~~beam~~~  ((( Receiver
Module 1                      Module 2

      [Person walks through]
              ↓
         Beam broken
              ↓
      Signal goes LOW
```
- Detection range: Up to 10 meters
- Used for counting people passing through
- Requires two modules facing each other

**Which type do you have?**
- If you have 2 identical sensors → Type A (Reflective)
- If you have transmitter + receiver pair → Type B (Beam-break)

---

## 🔧 CODE INTEGRATION

### For EXIT NODE (ESP32)

Add these  lines to your main.cpp:

**1. Add IR sensor pin definition** (around line 47, after LED pins):
```cpp
// Enhanced LED System (Multi-color LED support)
const int LED_RED = 26;
const int LED_GREEN = 27;
const int LED_BLUE = 14;

// *** ADD THIS ***
// IR Beam Sensor
const int IR_BEAM_PIN = 15;
volatile bool irBeamBroken = false;
volatile unsigned long lastIREvent = 0;
```

**2. Add interrupt handler** (before setup(), around line 80):
```cpp
// IR Beam Interrupt Handler
void IRAM_ATTR onIRBeamBreak() {
  unsigned long now = millis();
  // Debounce: Ignore events within 500ms
  if (now - lastIREvent > 500) {
    irBeamBroken = true;
    lastIREvent = now;
  }
}
```

**3. Initialize IR sensor in setup()** (find setup() function):
```cpp
void setup() {
  Serial.begin(115200);
  
  // ... existing code ...
  
  // *** ADD THIS before WiFi setup ***
  // Initialize IR beam sensor
  pinMode(IR_BEAM_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(IR_BEAM_PIN), onIRBeamBreak, FALLING);
  Serial.println("✓ IR beam sensor initialized on GPIO 15");
  
  // ... rest of setup code ...
}
```

**4. Add IR event publisher function** (add after MQTT functions):
```cpp
/**
 * Publish IR beam crossing event to MQTT
 */
void publishIRBeamCrossing() {
  if (!mqttClient.connected() || !isApproved) return;
  
  DynamicJsonDocument doc(512);
  doc["type"] = "IR_CROSSING";
  doc["deviceMAC"] = deviceMAC;
  doc["clusterID"] = clusterID;
  doc["deviceRole"] = deviceRole;
  doc["direction"] = "IN"; // or "OUT" if you have dual sensors
  doc["timestamp"] = millis();
  doc["scannerID"] = scannerID;
  
  String json;
  serializeJson(doc, json);
  
  if (mqttClient.publish(MQTT_TOPIC_EVENTS, json.c_str())) {
    Serial.println("📡 IR beam crossing published");
    
    // Visual feedback
    setLEDColor(BLUE, SOLID);
    delay(200);
    setLEDColor(OFF, SOLID);
  } else {
    Serial.println("❌ Failed to publish IR beam event");
  }
}
```

**5. Handle IR events in loop()** (find loop() function):
```cpp
void loop() {
  // ... existing code ...
  
  // *** ADD THIS in loop() ***
  // Handle IR beam sensor events
  if (irBeamBroken) {
    irBeamBroken = false;
    Serial.println("╔═══════════════════════════════╗");
    Serial.println("║  🚶 IR BEAM CROSSING (EXIT)  ║");
    Serial.println("╚═══════════════════════════════╝");
    publishIRBeamCrossing();
  }
  
  // ... rest of loop code ...
}
```

---

### For ENTRY NODE (ESP32-CAM)

Add these to your ENTRY_NODE main.cpp:

**1. Add IR sensor pin** (around line 95, after buzzer pin):
```cpp
// Hardware Pins
const int LED_FLASH = 4;          // Built-in LED flash
const int BUZZER_PIN = 12;        // Buzzer/Alarm pin (GPIO 12)
const int WIFI_RESET_BUTTON = 13; // Optional GPIO for WiFi reset

// *** ADD THIS ***
const int IR_BEAM_PIN = 14;       // IR beam sensor pin
volatile bool irBeamBroken = false;
volatile unsigned long lastIREvent = 0;
```

**2. Add interrupt handler** (before setup()):
```cpp
// IR Beam Interrupt Handler
void IRAM_ATTR onIRBeamBreak() {
  unsigned long now = millis();
  if (now - lastIREvent > 500) {
    irBeamBroken = true;
    lastIREvent = now;
  }
}
```

**3. Initialize in setup()**:
```cpp
void setup() {
  Serial.begin(115200);
  
  // ... existing code ...
  
  // *** ADD AFTER buzzer setup ***
  // Initialize IR beam sensor
  pinMode(IR_BEAM_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(IR_BEAM_PIN), onIRBeamBreak, FALLING);
  Serial.println("✓ IR beam sensor initialized on GPIO 14");
  
  // ... rest of setup ...
}
```

**4. Add WebSocket IR event sender**:
```cpp
/**
 * Send IR beam crossing via WebSocket
 */
void sendIRBeamCrossing() {
  if (!wsConnected) return;
  
  DynamicJsonDocument doc(512);
  doc["type"] = "IR_CROSSING";
  doc["deviceId"] = deviceMAC;
  doc["clusterID"] = clusterID;
  doc["role"] = "ENTRY";
  doc["direction"] = "IN";
  doc["timestamp"] = millis();
  
  String json;
  serializeJson(doc, json);
  webSocket.sendTXT(json);
  
  Serial.println("📡 IR beam crossing sent to server");
  
  // Visual feedback (brief buzzer beep)
  digitalWrite(BUZZER_PIN, HIGH);
  delay(50);
  digitalWrite(BUZZER_PIN, LOW);
}
```

**5. Handle in loop()**:
```cpp
void loop() {
  webSocket.loop();
  
  // *** ADD THIS ***
  // Handle IR beam events
  if (irBeamBroken) {
    irBeamBroken = false;
    Serial.println("╔═══════════════════════════════╗");
    Serial.println("║  🚶 IR BEAM CROSSING (ENTRY) ║");
    Serial.println("╚═══════════════════════════════╝");
    sendIRBeamCrossing();
  }
  
  // ... rest of loop ...
}
```

---

## 🧪 COMPLETE TESTING CHECKLIST

### ✅ Hardware Test
- [ ] IR sensor connected to EXIT NODE (GPIO 15)
- [ ] IR sensor connected to ENTRY NODE (GPIO 14)
- [ ] Both sensors powered (3.3V, GND)
- [ ] Serial monitor shows initialization messages
- [ ] Hand wave triggers detection on serial monitor
- [ ] Built-in LED blinks when sensor triggered

### ✅ Software Test
- [ ] Upload modified code to EXIT NODE
- [ ] Upload modified code to ENTRY NODE
- [ ] Both nodes connect to WiFi
- [ ] Both nodes connect to server (MQTT/WebSocket)
- [ ] IR events appear in server logs
- [ ] Dashboard shows IR crossing events

### ✅ Integration Test
- [ ] Scan fingerprint on EXIT → IR beam → Door unlocks
- [ ] Walk through doorway → IR sensors detect
- [ ] Tailgating scenario: 1 scan + 2 people → ALARM
- [ ] Both ENTRY and EXIT buzzers sound on alarm

---

## 📊 EXPECTED SERIAL OUTPUT

When working correctly, you should see:

**EXIT NODE:**
```
✓ IR beam sensor initialized on GPIO 15
✓ WiFi connected: 172.20.10.4
✓ MQTT connected
✓ Device approved by server
╔═══════════════════════════════╗
║  🚶 IR BEAM CROSSING (EXIT)  ║
╚═══════════════════════════════╝
📡 IR beam crossing published
```

**ENTRY NODE:**
```
✓ IR beam sensor initialized on GPIO 14
✓ WiFi connected: 172.20.10.5
✓ WebSocket connected
╔═══════════════════════════════╗
║  🚶 IR BEAM CROSSING (ENTRY) ║
╚═══════════════════════════════╝
📡 IR beam crossing sent to server
```

**SERVER:**
```
[TailgatingDetection] Person crossed IR beam: ENTRY
[TailgatingDetection] Session active: fingerprints=1, faces=1, crossings=1
✅ Normal entry detected
```

---

## 🔧 TROUBLESHOOTING

### "IR sensor not detecting anything"
- **Check wiring**: VCC, GND, OUT pins connected?
- **Check GPIO**: Make sure GPIO 15 (EXIT) or GPIO 14 (ENTRY)
- **Check voltage**: Measure OUT pin - should toggle between 0V and 3.3V
- **Test separately**: Use `ir_sensor_test.cpp` first

### "Sensor triggers constantly"
- **Adjust sensitivity**: Many IR sensors have a potentiometer to adjust range
- **Check mounting**: Move away from reflective surfaces
- **Add debouncing**: Increase delay in interrupt handler (500ms → 1000ms)

### "Serial shows detection but no MQTT/WebSocket"
- **Check connection**: Is ESP32 connected to server?
- **Check approval**: Device must be approved by server
- **Check topics**: MQTT topic = "biometric/events"

### "Sensor works once then stops"
- **Check interrupt**: May need to clear interrupt flag
- **Check INPUT_PULLUP**: Some sensors need INPUT instead
- **Power issue**: IR LED uses power, ensure stable 3.3V supply

---

## 🎯 SENSOR PLACEMENT

```
                  DOORWAY (Top View)
        ═══════════════════════════════════
        ║                                 ║
        ║    [ESP32-CAM]                  ║  ENTRY SIDE
        ║    IR Sensor ●)))               ║  (People come in)
        ║         ↓                       ║
        ║    Detection                    ║
        ║       Zone                      ║
        ║         ↓                       ║
        ║               (((● IR Sensor    ║  EXIT SIDE
        ║                  [ESP32]        ║  (People go in/out)
        ║                                 ║
        ═══════════════════════════════════
```

**Mounting Tips:**
1. Mount sensors at **waist height** (80-120cm)
2. Point sensors **perpendicular to door**
3. Keep sensors **stable** (vibration causes false triggers)
4. Test with actual people walking through
5. Adjust sensitivity pot if sensors have one

---

## 📝 NEXT STEPS

1. **Wire ONE sensor first** (EXIT NODE recommended)
2. **Upload test code** and verify detection
3. **Add integration code** to main.cpp
4. **Test with server** running
5. **Wire ENTRY sensor**
6. **Test complete system** with tailgating scenarios

---

## ⚡ QUICK START (Copy-Paste)

**For EXIT NODE** - Add to main.cpp:
```cpp
// At top (line ~50)
const int IR_BEAM_PIN = 15;
volatile bool irBeamBroken = false;
volatile unsigned long lastIREvent = 0;

void IRAM_ATTR onIRBeamBreak() {
  if (millis() - lastIREvent > 500) {
    irBeamBroken = true;
    lastIREvent = millis();
  }
}

// In setup()
pinMode(IR_BEAM_PIN, INPUT_PULLUP);
attachInterrupt(digitalPinToInterrupt(IR_BEAM_PIN), onIRBeamBreak, FALLING);

// In loop()
if (irBeamBroken) {
  irBeamBroken = false;
  // Publish MQTT event (use existing publishIRBeamCrossing() function)
}
```

Same pattern for ENTRY NODE, just change GPIO 15 → 14 and use WebSocket instead of MQTT.

---

**Need help?** Let me know:
- Which type of sensors you have (reflective or beam-break)
- Any error messages from serial monitor
- Whether sensors trigger correctly in test mode
