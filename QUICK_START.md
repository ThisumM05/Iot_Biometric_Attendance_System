# Quick Start Guide - Cluster-Based ESP32 System

## Prerequisites
- MongoDB running locally or connection string in `.env`
- RabbitMQ installed and running
- Node.js 16+ installed

## Server Setup (5 minutes)

### 1. Install Dependencies
```powershell
cd server
npm install
```

### 2. Configure Environment
Create/update `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/iot_biometric
RABBITMQ_URL=amqp://localhost
DASHBOARD_URL=http://localhost:5173
NODE_ENV=development
```

### 3. Start Server
```powershell
npm start
```

**Expected Output:**
```
Server running on port 5000
MongoDB Connected Successfully
Connected to RabbitMQ
[DeviceHealth] Starting auto-offline detection...
```

## Dashboard Setup (3 minutes)

### 1. Install Dependencies
```powershell
cd dashboard
npm install socket.io-client  # If not already installed
```

### 2. Add Socket.io to package.json
Ensure `socket.io-client` is listed in dependencies.

### 3. Start Dashboard
```powershell
npm run dev
```

**Expected Output:**
```
VITE v4.x.x  ready in xxx ms
Local: http://localhost:5173/
```

### 4. Add Route for Device Management
Update your dashboard router (e.g., `App.jsx` or routes file):

```jsx
import DeviceManagement from './pages/DeviceManagement';

// In your routes:
<Route path="/devices" element={<DeviceManagement />} />
```

Add navigation link:
```jsx
<NavLink to="/devices">
  <Server className="h-4 w-4" />
  Device Management
</NavLink>
```

## First-Time Configuration

### Step 1: Create a Cluster
Using API or MongoDB directly:

**Option A: API (recommended)**
```powershell
# Use curl or Postman
curl -X POST http://localhost:5000/api/devices/clusters `
  -H "Content-Type: application/json" `
  -d '{
    "clusterID": "DOOR_01",
    "clusterName": "Main Entrance",
    "location": "Building A - Ground Floor",
    "unlockDuration": 5000
  }'
```

**Option B: MongoDB Compass**
Insert into `clusters` collection:
```json
{
  "clusterID": "DOOR_01",
  "clusterName": "Main Entrance",
  "location": "Building A - Ground Floor",
  "devices": [],
  "unlockDuration": 5000,
  "status": "OPERATIONAL"
}
```

### Step 2: Power On ESP32 Devices
1. Flash ESP32-CAM (entry device) with code from ESP32_CONNECTION_GUIDE.md
2. Flash ESP32 (exit device) with code from ESP32_CONNECTION_GUIDE.md
3. Power on both devices
4. They will automatically send DEVICE_REGISTER messages

### Step 3: Approve Devices in Dashboard
1. Open dashboard: http://localhost:5173/devices
2. Go to "Pending Approval" tab
3. For **ESP32-CAM** (entry device):
   - Click "Approve"
   - Select Cluster: "Main Entrance"
   - Device Role: "Entry"
   - Scanner ID: "SCANNER_ENTRY_01"
   - Location: "Main Entrance - Inside"
   - Submit

4. For **ESP32** (exit device):
   - Click "Approve"
   - Select Cluster: "Main Entrance"
   - Device Role: "Exit"
   - Scanner ID: "SCANNER_EXIT_01"
   - Location: "Main Entrance - Outside"
   - Submit

### Step 4: Verify Cluster Status
In the "Clusters" tab, you should see:
- Cluster: Main Entrance
- Status: OPERATIONAL (green)
- 2 devices listed (ENTRY and EXIT)
- Both showing as ACTIVE with WiFi signal

## Testing Enrollment

### Method 1: Via Dashboard
1. Navigate to Student Management
2. Click "Add Student" or select existing student
3. Click "Enroll Fingerprint"
4. EnrollmentModal opens showing available scanners
5. Select "SCANNER_ENTRY_01" or "SCANNER_EXIT_01"
6. Click "Start Enrollment"
7. Follow on-screen instructions
8. Place finger on ESP32 sensor when prompted
9. Success! User is now enrolled on that specific scanner

### Method 2: Via API
```powershell
curl -X POST http://localhost:5000/api/devices/enroll `
  -H "Content-Type: application/json" `
  -d '{
    "userId": "605c72ef5b3e4b1e2c9b1234",
    "scannerID": "SCANNER_ENTRY_01",
    "deviceMAC": "AA:BB:CC:DD:EE:FF"
  }'
```

## Testing Attendance

### Step 1: Verify Setup
- Dashboard shows cluster OPERATIONAL
- Both devices show ACTIVE status
- User enrolled on at least one scanner

### Step 2: Scan Fingerprint
1. Go to entry device (ESP32-CAM)
2. Place enrolled finger on sensor
3. Camera captures image (multi-person detection)
4. If alone → Fingerprint verified

### Step 3: Expected Flow
1. **ESP32-CAM → Server**: ATTENDANCE event
2. **Server**: 
   - Looks up user by fingerprintId + scannerID
   - Checks multiPersonDetected flag
   - Validates access rules
   - Creates attendance record
3. **Server → ESP32**: UNLOCK_DOOR command to exit device
4. **ESP32 (Exit)**: Activates relay for 5 seconds
5. **Dashboard**: Real-time attendance update appears

### Step 4: Dashboard Verification
- Go to "Realtime Attendance" or "Attendance Logs"
- See new entry with user name, time, and cluster
- Device Management shows last scan time updated

## Testing Security Alert

### Scenario: Multiple People at Door
1. Two people stand in front of ESP32-CAM
2. One person scans fingerprint
3. Camera detects 2 faces → `multiPersonDetected: true`
4. **Expected Behavior**:
   - Server blocks entry
   - Dashboard shows security alert
   - Door remains LOCKED
   - Buzzer sounds on ESP32-CAM
   - Attendance NOT logged

## Health Monitoring

### Real-Time Dashboard Updates
Open Device Management page and watch for:
- WiFi signal strength updates (every 60 seconds)
- Uptime counter increases
- "Last Heartbeat" timestamp updates
- Device status changes if ESP32 powered off

### Testing Offline Detection
1. Power off one ESP32 device
2. Wait 2 minutes
3. Dashboard auto-updates:
   - Device status → OFFLINE (red badge)
   - Cluster status → DEGRADED (yellow badge)
4. Power on device → Status returns to ACTIVE/OPERATIONAL

## Manual Door Unlock

### Emergency Unlock
1. Go to Device Management → Clusters tab
2. Find cluster you want to unlock
3. Click "Unlock" button
4. Set duration (default 5000ms = 5 seconds)
5. Click "Unlock Door"
6. Server sends UNLOCK_DOOR command
7. Door unlocks for specified duration

## Troubleshooting

### ESP32 Not Appearing in Pending Devices
**Check:**
- RabbitMQ is running (`rabbitmq-server`)
- ESP32 WiFi credentials correct
- ESP32 can reach server IP
- Server RabbitMQ connection logs show "Connected to RabbitMQ"

**Debug:**
```powershell
# Check RabbitMQ queues
rabbitmqctl list_queues
# Should see: biometric_events, biometric_commands
```

### Enrollment Not Working
**Check:**
- Scanner is ACTIVE and online (Device Management page)
- Socket.io connection established (browser console: "Socket connected")
- ESP32 fingerprint sensor wired correctly
- ESP32 logs show received ENROLL command

### Door Not Unlocking
**Check:**
- Cluster has `doorControlDevice` set (exit device MAC)
- Exit device has relay capability
- Relay wiring correct (see ESP32_CONNECTION_GUIDE.md)
- Server logs show "Sending UNLOCK_DOOR command to..."

### Real-Time Updates Not Working
**Check:**
- Browser console shows Socket.io connection
- Server logs show Socket.io client connected
- No CORS errors in browser console

**Fix:**
```javascript
// In dashboard code, ensure:
const socket = io('http://localhost:5000', {
  withCredentials: true,
  transports: ['websocket', 'polling']
});
```

## Next Steps

### Add More Clusters
Repeat cluster creation for:
- Back entrance
- Side door
- Emergency exit
- Each unique door location

### Enroll Users on Multiple Scanners
- Same user can enroll different fingerprints on different scanners
- Or same fingerprint on multiple scanners
- Check User.enrollments array to see all enrollments

### Monitor System Health
- Review "Health Summary" cards
- Check "Unhealthy Devices" endpoint
- Set up alerts for offline devices

### Customize Settings
- Adjust `unlockDuration` per cluster
- Configure auto-offline threshold (default 2 minutes)
- Set up access control rules (future enhancement)

## Production Checklist

Before deploying to production:
- [ ] Change default credentials
- [ ] Enable authentication middleware on device routes
- [ ] Use HTTPS for dashboard
- [ ] Secure RabbitMQ with authentication
- [ ] Set up MongoDB replica set
- [ ] Configure firewall rules
- [ ] Enable device firmware signing
- [ ] Set up monitoring and alerting
- [ ] Configure backup strategy
- [ ] Document MAC addresses for all devices
- [ ] Create admin recovery procedures

## Documentation References

- **ESP32_CONNECTION_GUIDE.md**: Complete ESP32 hardware and firmware implementation
- **ESP32_SERVER_IMPLEMENTATION.md**: Detailed server architecture and API documentation
- **PIPELINE_ARCHITECTURE.md**: Overall system architecture

## Support

Common issues covered in ESP32_SERVER_IMPLEMENTATION.md:
- Message protocol specifications
- Database schema details
- Real-time event flows
- Security considerations

For hardware issues, see ESP32_CONNECTION_GUIDE.md:
- Wiring diagrams
- Pin configurations
- Troubleshooting sensor connections
- Firmware debugging
