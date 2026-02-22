# Template Deletion - Quick Start Guide

## ✅ Server-Side Implementation (COMPLETED)

### Feature 1: Auto-Delete Templates When User is Deleted

**What it does:**
- When you delete a user from dashboard, their fingerprint is automatically removed from ALL scanners
- Template data is cleared from MongoDB
- All device sync records are cleaned up

**API Endpoint:**
```
DELETE /api/users/:userId
```

**Implementation:**
- [userRoutes.js](server/routes/users/userRoutes.js) - Updated user deletion handler
- [templateSyncService.js](server/services/sync/templateSyncService.js) - `removeUserFromAllDevices()` method
- [rabbitMQService.js](server/services/rabbitmq/rabbitMQService.js) - `handleTemplateDeleteResult()` handler

---

### Feature 2: Clear All Templates from Specific Scanner

**What it does:**
- Clears ALL fingerprint templates from a specific scanner
- Updates database to remove that device from all users' sync records
- Useful for scanner reset or decommissioning

**API Endpoint:**
```
POST /api/sync/device/:deviceMAC/clear
```

**Example:**
```bash
curl -X POST http://localhost:5000/api/sync/device/68:FE:71:F8:31:A0/clear \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Implementation:**
- [templateSyncRoutes.js](server/routes/sync/templateSyncRoutes.js) - New clear endpoint
- [templateSyncService.js](server/services/sync/templateSyncService.js) - `clearDeviceTemplates()` and `handleClearDeviceResult()` methods
- [rabbitMQService.js](server/services/rabbitmq/rabbitMQService.js) - `handleClearDeviceResult()` handler

---

## 🔧 ESP32 Firmware Changes Required

### What You Need to Add to Your ESP32 Code:

#### 1. Add Two New Command Handlers

```cpp
// In your mqttCallback function, add:
else if (strcmp(action, "DELETE_TEMPLATE") == 0) {
    handleDeleteTemplate(doc);  // Delete ONE template
}
else if (strcmp(action, "CLEAR_ALL_TEMPLATES") == 0) {
    handleClearAllTemplates(doc);  // Delete ALL templates
}
```

#### 2. Implement These Functions

**For deleting single template:**
- `handleDeleteTemplate()` - Process command
- `deleteTemplateFromSensor()` - Call sensor API
- `sendTemplateDeleteResult()` - Send confirmation

**For clearing all templates:**
- `handleClearAllTemplates()` - Process command  
- `clearAllTemplatesFromSensor()` - Call sensor API
- `sendClearAllResult()` - Send confirmation

---

## 📝 Complete ESP32 Code

See [ESP32_TEMPLATE_DELETE_IMPLEMENTATION.md](ESP32_TEMPLATE_DELETE_IMPLEMENTATION.md) for:
- ✅ Copy-paste ready code
- ✅ Sensor-specific API examples (R307/R308, GT-521F32)
- ✅ Error handling and retry logic
- ✅ Watchdog timeout prevention
- ✅ LED/buzzer feedback examples
- ✅ Testing instructions

---

## 🧪 Quick Testing

### Test User Deletion with Template Cleanup

1. **Enroll a test user** on scanner
2. **Verify it works** - scan their finger
3. **Delete the user** from dashboard
4. **Check ESP32 logs** - should see:
   ```
   🗑️ DELETE TEMPLATE COMMAND RECEIVED
   ✅ TEMPLATE DELETED SUCCESSFULLY
   ```
5. **Try scanning** - should NOT recognize anymore

### Test Clear All Templates

1. **Test via API:**
   ```bash
   POST /api/sync/device/YOUR_DEVICE_MAC/clear
   ```

2. **Check ESP32 logs** - should see:
   ```
   🗑️ CLEAR ALL TEMPLATES COMMAND RECEIVED
   ✅ ALL TEMPLATES CLEARED (X templates removed)
   ```

3. **Verify** - no fingerprints should work

---

## 📊 Message Flow Diagrams

### User Deletion Flow

```
Dashboard → DELETE /api/users/:userId
    ↓
Server removes user from MongoDB
    ↓
Server sends DELETE_TEMPLATE to all synced scanners
    ↓
ESP32 receives DELETE_TEMPLATE command
    ↓
ESP32 deletes template from sensor
    ↓
ESP32 sends TEMPLATE_DELETE_RESULT back
    ↓
Server removes device from user.syncedDevices
    ↓
✅ Complete - User and templates removed
```

### Clear Scanner Flow

```
Dashboard/API → POST /api/sync/device/:deviceMAC/clear
    ↓
Server sends CLEAR_ALL_TEMPLATES to scanner
    ↓
ESP32 receives CLEAR_ALL_TEMPLATES command
    ↓
ESP32 empties entire fingerprint database
    ↓
ESP32 sends CLEAR_ALL_TEMPLATES_RESULT back
    ↓
Server updates all users to remove that device
    ↓
✅ Complete - Scanner cleared, database updated
```

---

## 🔑 Key ESP32 Functions to Implement

### Minimum Required (DELETE_TEMPLATE):

```cpp
void handleDeleteTemplate(JsonDocument& doc);
bool deleteTemplateFromSensor(int localId);
void sendTemplateDeleteResult(String userId, int globalFpId, int localFpId, bool success);
```

### Minimum Required (CLEAR_ALL_TEMPLATES):

```cpp
void handleClearAllTemplates(JsonDocument& doc);
int clearAllTemplatesFromSensor();
void sendClearAllResult(bool success, int clearedCount);
```

### For R307/R308 Sensors:

```cpp
finger.deleteModel(slotId);      // Delete one template
finger.emptyDatabase();          // Delete all templates
finger.getTemplateCount();       // Get count of templates
```

---

## 🚀 Implementation Steps

1. ✅ **Server is ready** - No changes needed
2. ⚠️ **Update ESP32 firmware** - Add handlers above
3. ✅ **Test user deletion** - Should auto-delete from scanners
4. ✅ **Test clear scanner** - API should clear all templates
5. ✅ **Monitor logs** - Verify confirmations received

---

## 💡 Quick Tips

**ESP32 Memory:**
- Use `StaticJsonDocument<512>` for delete responses (small)
- Use `DynamicJsonDocument` if you have complex payloads
- Feed watchdog with `yield()` in loops

**Error Handling:**
- Always send result back to server (success or failure)
- Add retry logic for unreliable operations
- Log sensor error codes for debugging

**User Experience:**
- Add LED/buzzer feedback for deletion operations
- Use different colors: RED = deletion, GREEN = success
- Provide clear serial console messages

**Testing:**
- Test with single user first
- Then test with multiple enrolled users
- Finally test clear all templates

---

## 📚 Documentation Files

1. **[ESP32_TEMPLATE_DELETE_IMPLEMENTATION.md](ESP32_TEMPLATE_DELETE_IMPLEMENTATION.md)** - Complete ESP32 code with detailed explanations
2. **[ESP32_TEMPLATE_SYNC_FIRMWARE.md](ESP32_TEMPLATE_SYNC_FIRMWARE.md)** - Original template sync documentation
3. **[GLOBAL_TEMPLATE_SYNC.md](GLOBAL_TEMPLATE_SYNC.md)** - System-wide sync architecture

---

## ❓ Need Help?

**If templates aren't deleting:**
- Check deviceMAC matches exactly
- Verify localFingerprintId is correct
- Check sensor API return codes
- Enable debug logging on ESP32

**If confirmations aren't received:**
- Verify RabbitMQ connection
- Check MQTT topic subscriptions
- Look for JSON serialization errors
- Test with smaller payloads

**If scanner doesn't respond:**
- Check targetDeviceMAC in command
- Ensure device is online and connected
- Verify MQTT message delivery
- Check sensor power and wiring

---

## 🎯 Next Steps

1. Open [ESP32_TEMPLATE_DELETE_IMPLEMENTATION.md](ESP32_TEMPLATE_DELETE_IMPLEMENTATION.md)
2. Copy the relevant code for your sensor type
3. Add to your ESP32 firmware
4. Upload and test
5. Verify with server logs and dashboard

Good luck! 🚀
