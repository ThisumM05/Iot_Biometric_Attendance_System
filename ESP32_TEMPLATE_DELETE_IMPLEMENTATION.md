# ESP32 Template Deletion Implementation Guide

## Overview

This guide explains how to implement template deletion functionality on your ESP32 fingerprint scanner to support:
1. **Individual template deletion** - When a user is deleted from the dashboard
2. **Clear all templates** - When bulk clearing a scanner's memory

---

## Server-Side Changes (✅ COMPLETED)

### What Was Implemented:

1. ✅ **User Deletion with Template Cleanup**
   - When user is deleted from dashboard, automatically sends `DELETE_TEMPLATE` command to all synced devices
   - Removes template from MongoDB
   - Clears syncedDevices array

2. ✅ **Clear Device Templates Endpoint**
   - New API: `POST /api/sync/device/:deviceMAC/clear`
   - Sends `CLEAR_ALL_TEMPLATES` command to specific scanner
   - Updates all user records to remove that device

3. ✅ **RabbitMQ Event Handlers**
   - `TEMPLATE_DELETE_RESULT` - Confirms single template deletion
   - `CLEAR_ALL_TEMPLATES_RESULT` - Confirms bulk template clear

---

## ESP32 Firmware Changes Required

### 1. Add DELETE_TEMPLATE Handler

This handles deleting a single user's fingerprint from the scanner.

```cpp
/**
 * Handle DELETE_TEMPLATE command from server
 * Deletes a specific fingerprint template from sensor
 */
void handleDeleteTemplate(JsonDocument& doc) {
    // 1. Check if command is for this device
    String targetMAC = doc["targetDeviceMAC"].as<String>();
    if (targetMAC != WiFi.macAddress()) {
        Serial.println("❌ DELETE_TEMPLATE: Not for this device");
        return; // Not for me
    }
    
    // 2. Extract parameters
    int globalFpId = doc["globalFingerprintId"];
    int localFpId = doc["localFingerprintId"];
    String userId = doc["userId"].as<String>();
    
    Serial.println("🗑️ DELETE TEMPLATE COMMAND RECEIVED");
    Serial.printf("   User: %s\n", userId.c_str());
    Serial.printf("   Global ID: %d -> Local ID: %d\n", globalFpId, localFpId);
    
    // Visual feedback (optional)
    blinkLED(RED, 2); // Blink red twice
    
    // 3. Delete template from sensor
    bool success = deleteTemplateFromSensor(localFpId);
    
    // 4. Send confirmation back to server
    sendTemplateDeleteResult(userId, globalFpId, localFpId, success);
    
    if (success) {
        Serial.println("   ✅ TEMPLATE DELETED SUCCESSFULLY");
    } else {
        Serial.println("   ❌ TEMPLATE DELETION FAILED");
    }
}

/**
 * Delete template from fingerprint sensor
 */
bool deleteTemplateFromSensor(int localId) {
    Serial.printf("   Deleting template from slot %d...\n", localId);
    
    // R307/R308 specific deletion (adapt for your sensor)
    uint8_t result = finger.deleteModel(localId);
    
    if (result == FINGERPRINT_OK) {
        Serial.printf("   ✓ Template deleted from slot %d\n", localId);
        return true;
    } else {
        Serial.printf("   ✗ Failed to delete template (error code: %d)\n", result);
        return false;
    }
}

/**
 * Send deletion result back to server
 */
void sendTemplateDeleteResult(String userId, int globalFpId, int localFpId, bool success) {
    StaticJsonDocument<512> response;
    
    response["type"] = "TEMPLATE_DELETE_RESULT";
    response["deviceMAC"] = WiFi.macAddress();
    response["scannerID"] = scannerID;
    response["timestamp"] = millis();
    
    JsonObject payload = response.createNestedObject("payload");
    payload["userId"] = userId;
    payload["globalFingerprintId"] = globalFpId;
    payload["localFingerprintId"] = localFpId;
    payload["deviceMAC"] = WiFi.macAddress(); // Important for server
    payload["success"] = success;
    
    if (!success) {
        payload["error"] = "Deletion failed";
    }
    
    // Publish result
    char buffer[512];
    serializeJson(response, buffer);
    publishToRabbitMQ(buffer);
    
    Serial.printf("   📤 Delete result sent: %s\n", success ? "SUCCESS" : "FAILED");
}
```

---

### 2. Add CLEAR_ALL_TEMPLATES Handler

This handles clearing **all** fingerprints from the scanner.

```cpp
/**
 * Handle CLEAR_ALL_TEMPLATES command from server
 * Clears ALL fingerprint templates from sensor memory
 */
void handleClearAllTemplates(JsonDocument& doc) {
    // 1. Check if command is for this device
    String targetMAC = doc["targetDeviceMAC"].as<String>();
    if (targetMAC != WiFi.macAddress()) {
        Serial.println("❌ CLEAR_ALL_TEMPLATES: Not for this device");
        return;
    }
    
    Serial.println("🗑️ CLEAR ALL TEMPLATES COMMAND RECEIVED");
    Serial.println("⚠️ WARNING: This will delete ALL fingerprints!");
    
    // Visual feedback - show critical operation
    blinkLED(RED, 5); // Blink red 5 times
    playBeep(TONE_WARNING, 200);
    delay(500);
    playBeep(TONE_WARNING, 200);
    
    // 2. Clear all templates from sensor
    int clearedCount = clearAllTemplatesFromSensor();
    
    bool success = (clearedCount >= 0); // -1 indicates error
    
    // 3. Send confirmation back to server
    sendClearAllResult(success, clearedCount);
    
    if (success) {
        Serial.printf("✅ ALL TEMPLATES CLEARED (%d templates removed)\n", clearedCount);
        setLED(GREEN, BLINKING);
        playBeep(TONE_SUCCESS, 300);
    } else {
        Serial.println("❌ FAILED TO CLEAR TEMPLATES");
        setLED(RED, BLINKING);
        playBeep(TONE_ERROR, 500);
    }
    
    delay(2000);
    setLED(OFF, OFF);
}

/**
 * Clear all templates from fingerprint sensor
 * @return Number of templates cleared, or -1 on error
 */
int clearAllTemplatesFromSensor() {
    Serial.println("   Clearing all templates from sensor...");
    
    // Method 1: Use sensor's empty database command (fastest)
    uint8_t result = finger.emptyDatabase();
    
    if (result == FINGERPRINT_OK) {
        // Get template count before clearing (for reporting)
        int clearedCount = getStoredTemplateCount();
        
        Serial.printf("   ✓ All templates cleared from sensor\n");
        
        // Reset local tracking arrays if you maintain them
        memset(usedSlots, 0, sizeof(usedSlots));
        
        return clearedCount;
    } else {
        Serial.printf("   ✗ Failed to clear database (error code: %d)\n", result);
        
        // Method 2: Fallback - Delete templates individually
        Serial.println("   Attempting individual deletion...");
        return clearTemplatesIndividually();
    }
}

/**
 * Fallback method: Clear templates one by one
 * @return Number of templates cleared, or -1 on error
 */
int clearTemplatesIndividually() {
    int clearedCount = 0;
    int failedCount = 0;
    
    // R308 has max 200 slots, R307 has 127
    for (int i = 1; i < MAX_FINGERPRINT_TEMPLATES; i++) {
        // Check if slot is occupied
        if (finger.loadModel(i) == FINGERPRINT_OK) {
            // Delete this template
            if (finger.deleteModel(i) == FINGERPRINT_OK) {
                clearedCount++;
                Serial.printf("   ✓ Slot %d cleared\n", i);
            } else {
                failedCount++;
                Serial.printf("   ✗ Slot %d deletion failed\n", i);
            }
        }
        
        // Feed watchdog to prevent timeout
        yield();
        if (i % 10 == 0) {
            esp_task_wdt_reset();
        }
    }
    
    Serial.printf("   Individual deletion: %d cleared, %d failed\n", 
                  clearedCount, failedCount);
    
    return (failedCount == 0) ? clearedCount : -1;
}

/**
 * Get count of stored templates (if sensor supports it)
 */
int getStoredTemplateCount() {
    // R307/R308 specific
    finger.getTemplateCount();
    return finger.templateCount;
}

/**
 * Send clear all templates result back to server
 */
void sendClearAllResult(bool success, int clearedCount) {
    StaticJsonDocument<512> response;
    
    response["type"] = "CLEAR_ALL_TEMPLATES_RESULT";
    response["deviceMAC"] = WiFi.macAddress();
    response["scannerID"] = scannerID;
    response["clusterID"] = clusterID;
    response["timestamp"] = millis();
    
    JsonObject payload = response.createNestedObject("payload");
    payload["deviceMAC"] = WiFi.macAddress(); // Important for server
    payload["success"] = success;
    payload["clearedCount"] = clearedCount;
    
    if (!success) {
        payload["error"] = "Failed to clear all templates";
    }
    
    // Publish result
    char buffer[512];
    serializeJson(response, buffer);
    publishToRabbitMQ(buffer);
    
    Serial.printf("   📤 Clear all result sent: %s (%d templates)\n", 
                  success ? "SUCCESS" : "FAILED", clearedCount);
}
```

---

### 3. Update MQTT Command Handler

Add the new command handlers to your main MQTT callback:

```cpp
void mqttCallback(char* topic, byte* payload, unsigned int length) {
    StaticJsonDocument<2048> doc;
    DeserializationError error = deserializeJson(doc, payload, length);
    
    if (error) {
        Serial.print("❌ JSON parse error: ");
        Serial.println(error.c_str());
        return;
    }
    
    const char* action = doc["action"];
    
    // Existing commands
    if (strcmp(action, "ENROLL") == 0) {
        handleEnrollCommand(doc);
    } 
    else if (strcmp(action, "ENROLL_WITH_TEMPLATE") == 0) {
        handleEnrollWithTemplate(doc);
    } 
    else if (strcmp(action, "INSTALL_TEMPLATE") == 0) {
        handleInstallTemplate(doc);
    } 
    else if (strcmp(action, "DEVICE_APPROVED") == 0) {
        handleDeviceApproved(doc);
    } 
    else if (strcmp(action, "UNLOCK_DOOR") == 0) {
        handleUnlockDoor(doc);
    }
    
    // NEW: Template deletion commands
    else if (strcmp(action, "DELETE_TEMPLATE") == 0) {
        handleDeleteTemplate(doc);
    }
    else if (strcmp(action, "CLEAR_ALL_TEMPLATES") == 0) {
        handleClearAllTemplates(doc);
    }
    
    else {
        Serial.printf("⚠️ Unknown action: %s\n", action);
    }
}
```

---

### 4. Add Helper Functions for LED & Sound (Optional)

```cpp
// LED patterns for visual feedback
#define LED_OFF 0
#define LED_SOLID 1
#define LED_BLINKING 2
#define LED_PULSING 3

// Colors
#define RED 0
#define GREEN 1
#define BLUE 2
#define YELLOW 3
#define CYAN 4

// Tones
#define TONE_SUCCESS 1000
#define TONE_ERROR 200
#define TONE_WARNING 400
#define TONE_INFO 600
#define TONE_READY 800

void setLED(int color, int pattern) {
    // Implement based on your LED hardware
    // RGB LED, or individual colored LEDs
}

void blinkLED(int color, int times) {
    for (int i = 0; i < times; i++) {
        setLED(color, LED_SOLID);
        delay(100);
        setLED(color, LED_OFF);
        delay(100);
    }
}

void playBeep(int frequency, int duration) {
    // Implement based on your buzzer hardware
    tone(BUZZER_PIN, frequency, duration);
    delay(duration);
    noTone(BUZZER_PIN);
}
```

---

### 5. Sensor-Specific API Reference

#### For R307/R308 Sensors (Adafruit Library)

```cpp
// Delete single template
uint8_t deleteModel(uint16_t id);
// Returns: FINGERPRINT_OK on success

// Empty entire database
uint8_t emptyDatabase();
// Returns: FINGERPRINT_OK on success

// Get template count
uint8_t getTemplateCount();
// Sets: finger.templateCount

// Load model to check if slot is occupied
uint8_t loadModel(uint16_t id);
// Returns: FINGERPRINT_OK if slot has template
```

#### For GT-521F32/GT-511C3 Sensors

```cpp
// Delete single template
bool DeleteID(int id);
// Returns: true on success

// Delete all templates
bool DeleteAll();
// Returns: true on success

// Check if ID exists
bool CheckEnrolled(int id);
// Returns: true if enrolled
```

---

## Testing Instructions

### Test 1: Single Template Deletion

1. **Dashboard Action**: Delete a user who has fingerprint enrolled
2. **Expected ESP32 Logs**:
   ```
   🗑️ DELETE TEMPLATE COMMAND RECEIVED
      User: 6991baa16f2d4f2aaca70466
      Global ID: 1 -> Local ID: 1
      Deleting template from slot 1...
      ✓ Template deleted from slot 1
      ✅ TEMPLATE DELETED SUCCESSFULLY
      📤 Delete result sent: SUCCESS
   ```
3. **Verification**: Try scanning that fingerprint - should not recognize

---

### Test 2: Clear All Templates

1. **Dashboard Action**: Call API endpoint (see below for testing)
2. **Expected ESP32 Logs**:
   ```
   🗑️ CLEAR ALL TEMPLATES COMMAND RECEIVED
   ⚠️ WARNING: This will delete ALL fingerprints!
      Clearing all templates from sensor...
      ✓ All templates cleared from sensor
   ✅ ALL TEMPLATES CLEARED (5 templates removed)
      📤 Clear all result sent: SUCCESS (5 templates)
   ```
3. **Verification**: Try scanning any fingerprint - none should recognize

---

## API Testing with Postman/cURL

### Delete User (Auto-deletes templates)

```bash
curl -X DELETE http://localhost:5000/api/users/USER_ID_HERE \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Clear Specific Scanner Templates

```bash
curl -X POST http://localhost:5000/api/sync/device/68:FE:71:F8:31:A0/clear \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "Clear command sent to SCANNER-OUT",
  "deviceMAC": "68:FE:71:F8:31:A0",
  "scannerID": "SCANNER-OUT"
}
```

---

## Dashboard Integration (Optional)

Add a "Clear Scanner" button in Device Management:

```jsx
const clearScanner = async (deviceMAC) => {
  if (!confirm('⚠️ This will delete ALL fingerprints from this scanner. Continue?')) {
    return;
  }
  
  try {
    const response = await fetch(
      `${API_BASE}/sync/device/${deviceMAC}/clear`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const data = await response.json();
    
    if (data.success) {
      toast.success(`Clear command sent to ${data.scannerID}`);
    }
  } catch (error) {
    toast.error('Failed to clear scanner');
  }
};

// In your device card component:
<Button 
  variant="destructive" 
  onClick={() => clearScanner(device.deviceMAC)}
>
  🗑️ Clear All Templates
</Button>
```

---

## Memory Considerations

### watchdog Timeout Prevention

When clearing many templates individually:

```cpp
int clearTemplatesIndividually() {
    int clearedCount = 0;
    
    for (int i = 1; i < MAX_FINGERPRINT_TEMPLATES; i++) {
        if (finger.deleteModel(i) == FINGERPRINT_OK) {
            clearedCount++;
        }
        
        // IMPORTANT: Feed watchdog every 10 iterations
        if (i % 10 == 0) {
            yield();
            esp_task_wdt_reset();
            Serial.printf("   Progress: %d/%d\n", i, MAX_FINGERPRINT_TEMPLATES);
        }
    }
    
    return clearedCount;
}
```

---

## Error Handling

### Retry Logic for Failed Deletions

```cpp
bool deleteTemplateWithRetry(int localId, int maxRetries = 3) {
    for (int attempt = 1; attempt <= maxRetries; attempt++) {
        Serial.printf("   Attempt %d/%d to delete slot %d\n", 
                      attempt, maxRetries, localId);
        
        if (finger.deleteModel(localId) == FINGERPRINT_OK) {
            return true;
        }
        
        delay(500); // Wait before retry
    }
    
    Serial.printf("   ✗ Failed to delete slot %d after %d attempts\n", 
                  localId, maxRetries);
    return false;
}
```

---

## Summary of Required ESP32 Changes

✅ **Add these functions:**
1. `handleDeleteTemplate()` - Handle single template deletion
2. `handleClearAllTemplates()` - Handle bulk template clear
3. `deleteTemplateFromSensor()` - Sensor API for single delete
4. `clearAllTemplatesFromSensor()` - Sensor API for bulk clear
5. `sendTemplateDeleteResult()` - Report deletion result
6. `sendClearAllResult()` - Report clear all result

✅ **Update MQTT handler:**
- Add `DELETE_TEMPLATE` command handling
- Add `CLEAR_ALL_TEMPLATES` command handling

✅ **Optional but recommended:**
- Add LED/buzzer feedback for user awareness
- Add watchdog feeding for long operations
- Add retry logic for failed deletions

---

## What Happens When User is Deleted:

1. 🖥️ **Dashboard**: Admin clicks "Delete" on user
2. 📤 **Server**: Sends `DELETE_TEMPLATE` to all synced devices
3. 📥 **ESP32**: Receives command, deletes local fingerprint
4. 📤 **ESP32**: Sends `TEMPLATE_DELETE_RESULT` confirmation
5. 💾 **Server**: Updates database, removes device from user's syncedDevices
6. 🎉 **Complete**: User deleted, all traces removed from all scanners

---

## Questions or Issues?

Common problems:
- **Sensor returns error code**: Check sensor datasheet for error meanings
- **Watchdog timeout**: Add more `yield()` calls in loops
- **Template not deleted**: Verify localFingerprintId is correct
- **No confirmation received**: Check RabbitMQ connection

Refer to your fingerprint sensor's datasheet for specific API commands!
