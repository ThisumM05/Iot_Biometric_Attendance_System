# AI/ML Implementation Guide for IoT Biometric Attendance System

## Overview
This guide explains how to implement the advanced AI/ML features in your IoT biometric attendance system, building on the existing IR beam + ESP32-CAM + RabbitMQ architecture.

## System Architecture

```
IR Beam Sensors → ESP32-CAM → Image Capture → AI/ML Processing → RabbitMQ → Backend → MongoDB → Dashboard
```

## 1. Behavior-Pattern Analysis Implementation

### Current Integration Point
- **Data Source**: Attendance logs already stored in MongoDB (`DailyAttendance` collection)
- **Processing**: Backend service analyzes historical data periodically

### Implementation Steps

#### Backend Service (`behaviorAnalysisService.js`)
```javascript
// File: server/services/analytics-ml/behaviorAnalysisService.js

class BehaviorAnalysisService {
    async analyzeUserBehavior(userId) {
        // 1. Fetch attendance history from MongoDB
        const attendanceLogs = await DailyAttendance.find({ user: userId })
            .sort({ date: -1 })
            .limit(30); // Last 30 days
        
        // 2. Calculate behavior metrics
        const avgArrivalTime = this.calculateAverageArrival(attendanceLogs);
        const punctualityScore = this.calculatePunctuality(attendanceLogs);
        const attendanceRate = this.calculateAttendanceRate(attendanceLogs);
        
        // 3. Store results in behavior_patterns collection
        await BehaviorPattern.findOneAndUpdate(
            { userId },
            {
                avgArrivalTime,
                punctualityScore,
                attendanceRate,
                lastUpdated: new Date()
            },
            { upsert: true }
        );
        
        return { avgArrivalTime, punctualityScore, attendanceRate };
    }
}
```

#### Database Schema
```javascript
// File: server/models/BehaviorPattern.js
const behaviorPatternSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    avgArrivalTime: String, // "08:15"
    punctualityScore: Number, // 0-100
    attendanceRate: Number, // 0-100
    behaviorCluster: String, // "Early Birds", "Regular", "Frequently Late"
    lastUpdated: { type: Date, default: Date.now }
});
```

### Trigger Points
- **Daily**: Analyze patterns for all users at midnight
- **Real-time**: Update when new attendance event arrives via RabbitMQ
- **On-demand**: Dashboard requests individual user analysis

---

## 2. Time-Series Forecasting Implementation

### Current Integration Point
- **Data Source**: Historical attendance data from MongoDB
- **Processing**: Python microservice called from Node.js backend

### Implementation Steps

#### Python ML Service
```python
# File: ml-services/forecasting_service.py
import pandas as pd
from fbprophet import Prophet
import joblib

class AttendanceForecastingService:
    def train_model(self, user_id):
        # 1. Load attendance history from MongoDB
        attendance_data = self.load_user_attendance(user_id)
        
        # 2. Prepare data for Prophet
        df = pd.DataFrame({
            'ds': attendance_data['dates'],  # dates
            'y': attendance_data['present']  # binary: 1=present, 0=absent
        })
        
        # 3. Train Prophet model
        model = Prophet(daily_seasonality=True, weekly_seasonality=True)
        model.fit(df)
        
        # 4. Save model
        joblib.dump(model, f'models/{user_id}_attendance_model.pkl')
        return model
    
    def predict_attendance(self, user_id, days_ahead=7):
        # Load model and make predictions
        model = joblib.load(f'models/{user_id}_attendance_model.pkl')
        
        future = model.make_future_dataframe(periods=days_ahead)
        forecast = model.predict(future)
        
        return forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(days_ahead)
```

#### Node.js Integration
```javascript
// File: server/services/analytics-ml/forecastingService.js
class ForecastingService {
    async getPredictions(userId) {
        // Call Python service
        const pythonService = spawn('python', ['ml-services/forecasting_service.py', userId]);
        
        // Process results and store in MongoDB
        const predictions = await this.processPythonOutput(pythonService);
        
        await PredictedAttendance.insertMany(predictions);
        return predictions;
    }
}
```

---

## 3. Clustering Algorithms Implementation

### Current Integration Point
- **Data Source**: Behavior patterns from step 1
- **Processing**: Python clustering service

### Implementation Steps

#### Python Clustering Service
```python
# File: ml-services/clustering_service.py
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import numpy as np

class BehaviorClusteringService:
    def cluster_users(self):
        # 1. Load behavior features for all users
        users_data = self.load_behavior_features()
        
        # 2. Feature engineering
        features = np.array([
            users_data['avg_arrival_minutes'],  # Convert "08:15" to minutes from midnight
            users_data['punctuality_scores'],
            users_data['attendance_rates']
        ]).T
        
        # 3. Standardize features
        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(features)
        
        # 4. Apply KMeans clustering
        kmeans = KMeans(n_clusters=5, random_state=42)
        cluster_labels = kmeans.fit_predict(features_scaled)
        
        # 5. Assign cluster names
        cluster_names = [
            "Punctual", "Early Birds", "Regular", 
            "Frequently Late", "Irregular"
        ]
        
        return cluster_labels, cluster_names
```

---

## 4. YOLOv8 Object Detection Implementation

### Current Integration Point
- **Trigger**: IR beam break event
- **Data Flow**: ESP32-CAM → Backend → YOLOv8 → Analysis

### Implementation Steps

#### ESP32-CAM Code Addition
```cpp
// File: esp32_cam/attendance_monitor.ino

void onIRBeamBreak() {
    // Existing fingerprint logic...
    
    // NEW: Capture image for YOLO analysis
    camera_fb_t* fb = esp_camera_fb_get();
    if (fb) {
        // Send image to backend via HTTP POST
        sendImageToBackend(fb->buf, fb->len, "ir_beam_trigger");
        esp_camera_fb_return(fb);
    }
}

void sendImageToBackend(uint8_t* imageBuffer, size_t imageSize, String eventType) {
    HTTPClient http;
    http.begin("http://backend-server:5000/api/vision/analyze");
    http.addHeader("Content-Type", "image/jpeg");
    http.addHeader("X-Event-Type", eventType);
    
    int httpResponseCode = http.POST(imageBuffer, imageSize);
    http.end();
}
```

#### Backend YOLO Service
```javascript
// File: server/services/analytics-ml/visionAnalyticsService.js
const { spawn } = require('child_process');

class VisionAnalyticsService {
    async analyzeImage(imageBuffer, eventType) {
        // 1. Save image temporarily
        const imagePath = `/tmp/frame_${Date.now()}.jpg`;
        fs.writeFileSync(imagePath, imageBuffer);
        
        // 2. Run YOLO detection
        const yoloResult = await this.runYOLODetection(imagePath);
        
        // 3. Parse results
        const peopleCount = yoloResult.detections.filter(d => d.class === 'person').length;
        const confidence = yoloResult.confidence;
        
        // 4. Store analysis results
        const analysis = {
            timestamp: new Date(),
            peopleDetected: peopleCount,
            confidence,
            eventType,
            imagePath
        };
        
        await VisionAnalysis.create(analysis);
        
        // 5. Check for tailgating
        if (eventType === 'ir_beam_trigger' && peopleCount > 1) {
            await this.triggerTailgatingAlert(analysis);
        }
        
        return analysis;
    }
    
    async runYOLODetection(imagePath) {
        return new Promise((resolve, reject) => {
            const python = spawn('python', ['ml-services/yolo_detector.py', imagePath]);
            
            let output = '';
            python.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            python.on('close', (code) => {
                if (code === 0) {
                    resolve(JSON.parse(output));
                } else {
                    reject(new Error('YOLO detection failed'));
                }
            });
        });
    }
}
```

#### Python YOLO Service
```python
# File: ml-services/yolo_detector.py
import sys
from ultralytics import YOLO
import json

def detect_people(image_path):
    # Load YOLOv8 model
    model = YOLO('yolov8n.pt')  # or yolov8s.pt for better accuracy
    
    # Run detection
    results = model(image_path)
    
    detections = []
    for result in results:
        for box in result.boxes:
            if result.names[int(box.cls)] == 'person':
                detections.append({
                    'class': 'person',
                    'confidence': float(box.conf),
                    'bbox': box.xyxy.tolist()
                })
    
    return {
        'detections': detections,
        'confidence': max([d['confidence'] for d in detections]) if detections else 0
    }

if __name__ == "__main__":
    image_path = sys.argv[1]
    result = detect_people(image_path)
    print(json.dumps(result))
```

---

## 5. Feature Extraction Implementation

### Advanced Computer Vision Features

#### Facial Landmarks Detection
```python
# File: ml-services/feature_extraction.py
import mediapipe as mp
import cv2
import numpy as np

class FeatureExtractor:
    def __init__(self):
        self.face_mesh = mp.solutions.face_mesh.FaceMesh()
        self.pose = mp.solutions.pose.Pose()
    
    def extract_facial_features(self, image):
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_image)
        
        if results.multi_face_landmarks:
            landmarks = []
            for face_landmarks in results.multi_face_landmarks:
                for landmark in face_landmarks.landmark:
                    landmarks.append([landmark.x, landmark.y, landmark.z])
            return np.array(landmarks)
        return None
    
    def extract_pose_features(self, image):
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = self.pose.process(rgb_image)
        
        if results.pose_landmarks:
            pose_data = []
            for landmark in results.pose_landmarks.landmark:
                pose_data.append([landmark.x, landmark.y, landmark.z])
            return np.array(pose_data)
        return None
```

---

## 6. Anomaly Detection Implementation

### Statistical Anomaly Detection

#### Backend Service
```javascript
// File: server/services/analytics-ml/anomalyDetectionService.js

class AnomalyDetectionService {
    async detectAttendanceAnomalies(userId) {
        // 1. Get user's typical behavior pattern
        const behaviorPattern = await BehaviorPattern.findOne({ userId });
        
        // 2. Get recent attendance events
        const recentEvents = await DailyAttendance.find({ user: userId })
            .sort({ date: -1 })
            .limit(7);
        
        // 3. Check for anomalies
        const anomalies = [];
        
        for (const event of recentEvents) {
            // Check arrival time anomaly
            const arrivalDeviation = this.calculateTimeDeviation(
                event.arrivalTime, 
                behaviorPattern.avgArrivalTime
            );
            
            if (Math.abs(arrivalDeviation) > 60) { // 60 minutes threshold
                anomalies.push({
                    type: 'unusual_arrival_time',
                    severity: arrivalDeviation > 60 ? 'late' : 'early',
                    message: `Arrived ${Math.abs(arrivalDeviation)} minutes ${arrivalDeviation > 0 ? 'later' : 'earlier'} than usual`,
                    timestamp: event.date
                });
            }
        }
        
        // 4. Store anomalies
        if (anomalies.length > 0) {
            await AttendanceAnomaly.insertMany(
                anomalies.map(a => ({ ...a, userId }))
            );
        }
        
        return anomalies;
    }
}
```

---

## System Integration Flow

### Complete Event Flow
1. **IR Beam Break** → ESP32-CAM captures image
2. **Image Analysis** → YOLOv8 detects people count
3. **Attendance Event** → Fingerprint authentication occurs
4. **Data Packaging** → Event sent to RabbitMQ with image analysis results
5. **Backend Processing** → Node.js processes event, stores in MongoDB
6. **ML Analysis Trigger** → Background services update behavior patterns
7. **Anomaly Detection** → Check for unusual patterns
8. **Real-time Updates** → Dashboard receives WebSocket updates
9. **Forecasting Update** → Periodic model retraining with new data

### Database Collections
```javascript
// Core attendance data
DailyAttendance: { user, date, arrivalTime, exitTime, status }

// ML-enhanced collections  
BehaviorPatterns: { userId, avgArrivalTime, punctualityScore, behaviorCluster }
VisionAnalytics: { timestamp, peopleDetected, confidence, imagePath }
AttendanceAnomalies: { userId, type, severity, message, timestamp }
PredictedAttendance: { userId, date, predictedPresence, confidence }
```

### API Endpoints
```javascript
// Existing: /api/analytics/* (already implemented)
// New ML endpoints:
POST /api/vision/analyze - Process ESP32-CAM images
GET /api/behavior/:userId - Get user behavior analysis  
GET /api/predictions/:userId - Get attendance predictions
GET /api/anomalies - Get recent anomalies
GET /api/clusters - Get behavior clustering results
```

This implementation builds seamlessly on your existing system, adding AI/ML capabilities without disrupting the core attendance flow.