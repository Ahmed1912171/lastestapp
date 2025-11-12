# 📍 Geofencing Implementation - Complete Guide

## 🎯 Overview

**Geofencing** ensures employees can **ONLY** mark attendance when they are physically present at the hospital location. This prevents remote check-ins and ensures accountability.

---

## 🔧 **What's Been Implemented**

### **1. Location Tracking**
- ✅ Uses **expo-location** for GPS
- ✅ Requests foreground permissions on app load
- ✅ Gets high-accuracy GPS coordinates
- ✅ Real-time location status display

### **2. Geofence Validation**
- ✅ Defines hospital coordinates for each branch
- ✅ Sets allowed radius (default: 200 meters)
- ✅ Calculates distance using **Haversine formula**
- ✅ Blocks Check In/Out if outside geofence

### **3. User Experience**
- ✅ Visual location status indicator (Green/Red)
- ✅ Shows current GPS coordinates
- ✅ Displays distance from hospital
- ✅ "Retry" option to refresh location
- ✅ Clear error messages

---

## 🗺️ **Branch Locations** (Update These!)

Current configuration in `attendance.tsx`:

```typescript
const BRANCH_LOCATIONS = {
  korangi: {
    latitude: 24.8607,   // ⚠️ REPLACE WITH ACTUAL COORDINATES
    longitude: 67.0011,
    name: "Korangi Branch",
    radius: 200, // 200 meters
  },
  azambasti: {
    latitude: 24.8700,   // ⚠️ REPLACE WITH ACTUAL COORDINATES
    longitude: 67.0100,
    name: "Azambasti Branch",
    radius: 200,
  },
  // Add other branches...
};
```

---

## 📍 **How to Get Hospital Coordinates**

### **Method 1: Google Maps (Easy)**

1. **Open Google Maps** on your phone/computer
2. **Navigate to the hospital**
3. **Right-click** (or long-press on mobile)
4. **Click the coordinates** at the top
5. **Copy:** `24.8607452, 67.0011234`

### **Method 2: Use Your Phone**

1. **Stand at hospital entrance**
2. **Open attendance app**
3. **Check the debug panel** - it shows your GPS coordinates
4. **Copy those coordinates** to `BRANCH_LOCATIONS`

### **Method 3: Online Tool**

- Visit: https://www.latlong.net/
- Search for "SICHN Korangi" or your hospital address
- Copy coordinates

---

## ⚙️ **Radius Configuration**

```typescript
radius: 200  // 200 meters = approximately 650 feet
```

**Recommended Values:**
- **Small clinic:** 50-100 meters
- **Medium hospital:** 100-200 meters  
- **Large hospital campus:** 200-500 meters

**Testing tip:** Start with larger radius (500m) for testing, then reduce to 200m for production.

---

## 🎨 **Visual Indicators**

### **Within Geofence (Green):**
```
┌────────────────────────────────────┐
│ 📍 Location: Korangi Branch        │ Green background
│ ✅ Within range (45m)              │ Green border
│ GPS: 24.86074, 67.00112            │
└────────────────────────────────────┘
```

### **Outside Geofence (Red):**
```
┌────────────────────────────────────┐
│ 📍 Location: Korangi Branch        │ Red background
│ ❌ Outside range (543m away)       │ Red border
│ GPS: 24.87234, 67.01456            │
└────────────────────────────────────┘
```

### **Location Permission Denied:**
```
┌────────────────────────────────────┐
│ 📍 Location: Korangi Branch        │ Red background
│ ❌ Location permission denied      │ Red border
└────────────────────────────────────┘
```

---

## 🧪 **Testing Geofencing**

### **Test 1: Outside Hospital (Simulated)**

**Method A: Change Hospital Coordinates**
```typescript
korangi: {
  latitude: 0.0000,  // ← Fake coordinates (middle of ocean!)
  longitude: 0.0000,
  radius: 200,
}
```

**Expected:**
- Location panel shows **RED**
- `❌ Outside range (15432km away)`
- Check In button is **GRAY/DISABLED**
- Check Out button is **GRAY/DISABLED**

**When you click Check In:**
```
Alert: "📍 Location Required"
Message: "You must be at Korangi Branch to mark attendance.
         ❌ Outside range (15432km away)"
Buttons: [Retry] [Cancel]
```

---

### **Test 2: Inside Hospital (Real Testing)**

1. **Get actual hospital coordinates**
2. **Update `BRANCH_LOCATIONS`**
3. **Go to the hospital**
4. **Open attendance app**

**Expected:**
- Location panel shows **GREEN**
- `✅ Within range (45m)` (or whatever distance)
- Check In button is **BLUE/ACTIVE**
- Check Out button follows normal logic

---

### **Test 3: Nearby (Edge Case)**

**Set radius to 50m, stand 75m away:**
- Should show RED
- Should block attendance
- Shows exact distance: `❌ Outside range (75m away)`

**Walk closer (within 50m):**
- Should turn GREEN automatically
- Should enable buttons
- Shows: `✅ Within range (35m)`

---

## 🔍 **How Geofence Works**

### **1. On App Load:**
```
App Opens
  ↓
Request Location Permission
  ↓
Get Current GPS (latitude, longitude)
  ↓
Calculate Distance to Hospital
  ↓
distance = Haversine(currentGPS, hospitalGPS)
  ↓
Check: distance <= radius?
  ↓
YES → Green panel, buttons enabled
NO  → Red panel, buttons disabled
```

### **2. When User Clicks Check In:**
```
Button Pressed
  ↓
Is within geofence?
  ↓
NO → Show alert "Location Required"
     ↓
     User clicks "Retry"
     ↓
     Get fresh GPS
     ↓
     Recalculate distance
     ↓
     Still outside? → Show distance
     Within range? → Continue to check-in
  ↓
YES → Proceed with check-in API call
```

---

## 📊 **Distance Calculation (Haversine Formula)**

```javascript
// Example:
Hospital: 24.8607, 67.0011
User:     24.8620, 67.0015

Distance = 156 meters

156m <= 200m (radius)? → YES ✅ Within range
```

**Formula accounts for:**
- Earth's curvature
- Latitude/longitude differences
- Returns distance in meters

---

## 🎯 **Security Features**

| Feature | Status |
|---------|--------|
| GPS verification before Check In | ✅ |
| GPS verification before Check Out | ✅ |
| High accuracy location | ✅ |
| Distance calculation | ✅ |
| Configurable radius per branch | ✅ |
| Real-time location status | ✅ |
| Retry mechanism | ✅ |
| Visual feedback (Green/Red) | ✅ |

---

## 🚀 **Quick Start**

### **Step 1: Get Hospital GPS Coordinates**

**For Korangi Hospital:**
1. Open Google Maps
2. Search "SICHN Korangi" or your hospital address
3. Right-click on the location pin
4. Copy coordinates (e.g., `24.860745, 67.001123`)

### **Step 2: Update Code**

Edit `attendance.tsx` around line 73:

```typescript
korangi: {
  latitude: 24.860745,   // ← YOUR ACTUAL COORDINATES
  longitude: 67.001123,  // ← YOUR ACTUAL COORDINATES
  name: "Korangi Branch",
  radius: 200,  // Adjust as needed
},
```

### **Step 3: Test Outside Hospital**

```bash
# Rebuild app with location permissions
npx expo start --clear
```

1. Login
2. Go to Attendance
3. **If outside hospital:** 
   - See RED location panel
   - Buttons disabled
   - Alert shows when clicking

4. **If inside hospital:**
   - See GREEN location panel
   - Buttons enabled
   - Can mark attendance

---

## 📱 **Permissions**

### **Android (AndroidManifest.xml)**

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

Expo handles this automatically!

### **iOS (Info.plist)**

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to verify you're at the hospital for attendance marking</string>
```

Expo handles this automatically too!

---

## 🧪 **Test Scenarios**

### **Scenario 1: First Time (Permission Request)**
```
1. Open app (first time)
2. See permission dialog: "Allow [App] to access your location?"
3. Click "Allow While Using App"
4. Location panel shows checking...
5. Updates to Green/Red based on location
```

### **Scenario 2: At Hospital**
```
1. Stand inside hospital (within 200m)
2. Location panel: ✅ Green
3. Status: "Within range (45m)"
4. Check In button: Blue/Active
5. Can mark attendance successfully
```

### **Scenario 3: Outside Hospital**
```
1. Away from hospital (>200m)
2. Location panel: ❌ Red
3. Status: "Outside range (543m away)"
4. Check In button: Gray/Disabled
5. Click button → Alert shows
6. Click "Retry" → Rechecks location
7. Still outside → Shows error
```

### **Scenario 4: Edge of Geofence**
```
1. Stand exactly at 200m boundary
2. Walk towards hospital
3. Watch panel change from Red → Green
4. Buttons enable automatically
5. Mark attendance
```

---

## 🛠️ **Troubleshooting**

### **Issue: Always Shows "Outside Range"**
**Cause:** Wrong hospital coordinates  
**Fix:** 
1. Stand at hospital entrance
2. Check debug panel GPS
3. Update `BRANCH_LOCATIONS` with those coordinates

### **Issue: Permission Denied**
**Cause:** User clicked "Deny" on permission dialog  
**Fix:**
1. Go to Phone Settings → Apps → [Your App] → Permissions
2. Enable Location
3. Restart app

### **Issue: "Location unavailable"**
**Cause:** GPS not working (indoors, airplane mode)  
**Fix:**
1. Ensure location services ON
2. Go outside for better GPS signal
3. Disable airplane mode

### **Issue: Too Sensitive (Always Outside)**
**Fix:** Increase radius:
```typescript
radius: 500  // Increase from 200 to 500 meters
```

---

## 🔒 **Production Considerations**

### **Accuracy:**
- ✅ Uses `Location.Accuracy.High` (~5-10m accuracy)
- ✅ Haversine formula for precise distance
- ✅ Works outdoors and indoors (with slight delay)

### **Security:**
- ✅ Cannot be bypassed without GPS spoofing
- ✅ Location checked every time
- ✅ Retry mechanism prevents one-time GPS errors
- ⚠️ GPS spoofing apps can bypass (consider adding IP check)

### **Performance:**
- ✅ Location fetched once on load
- ✅ Rechecked on retry
- ✅ No continuous tracking (battery friendly)
- ✅ Fast calculation (< 1ms)

---

## 📊 **Console Logs (For Debugging)**

```javascript
📍 Location Check: {
  currentLocation: { latitude: 24.8620, longitude: 67.0015 },
  hospitalLocation: "Korangi Branch",
  distance: 156,  // meters
  radius: 200,
  withinRange: true  // ✅ Inside geofence
}
```

---

## 🎨 **UI States**

| State | Location Panel | Check In Button | Check Out Button |
|-------|----------------|-----------------|------------------|
| **Permission Denied** | 🔴 Red | ⚪ Gray (Disabled) | ⚪ Gray (Disabled) |
| **Outside Geofence** | 🔴 Red | ⚪ Gray (Disabled) | ⚪ Gray (Disabled) |
| **Inside Geofence** | 🟢 Green | 🔵 Blue (Active) | Follows normal logic |
| **After Check In** | 🟢 Green | 🟢 Green (Done) | 🟠 Orange (Active) |
| **After Check Out** | 🟢 Green | 🟢 Green (Done) | 🟢 Green (Done) |

---

## 🚀 **Step-by-Step Testing**

### **Phase 1: Setup (1 minute)**

1. Get your hospital's GPS coordinates
2. Update `BRANCH_LOCATIONS` in `attendance.tsx` (line ~73)
3. Save the file

### **Phase 2: Test Outside (2 minutes)**

1. **Stay home** or anywhere NOT at the hospital
2. Rebuild app: `npx expo start --clear`
3. Login with your credentials
4. Go to Attendance tab
5. Grant location permission when asked
6. **Expected:**
   - Location panel: 🔴 **RED**
   - Status: `❌ Outside range (X km away)`
   - Check In button: **GRAY (disabled)**
   - Check Out button: **GRAY (disabled)**
7. Click Check In button
8. **Expected Alert:**
   ```
   📍 Location Required
   
   You must be at Korangi Branch to mark attendance.
   
   ❌ Outside range (5432m away)
   
   [Retry] [Cancel]
   ```

### **Phase 3: Test Inside (5 minutes)**

1. **Go to the hospital** (physically)
2. Open attendance app
3. Wait for GPS to acquire signal (~10 seconds)
4. **Expected:**
   - Location panel: 🟢 **GREEN**
   - Status: `✅ Within range (45m)` (or your actual distance)
   - Check In button: **BLUE (enabled)**
5. Click Check In → Should work! ✅
6. Check Out button → **ORANGE (enabled)**
7. Click Check Out → Should work! ✅

### **Phase 4: Test Edge Cases (Optional)**

**Test A: Walk to edge of geofence**
- Stand at exactly 200m from hospital
- Watch panel switch from Green to Red
- Try marking attendance at different distances

**Test B: GPS signal loss**
- Go inside basement/elevator
- Location might become unavailable
- App shows error message

**Test C: Permission denial**
- Deny location permission
- App shows red panel
- Cannot mark attendance

---

## 🔧 **Configuration Options**

### **Change Radius:**

```typescript
radius: 500  // Increase to 500 meters for larger campus
radius: 100  // Decrease to 100 meters for small building
```

### **Change Accuracy:**

```typescript
// Higher accuracy (slower, more battery)
Location.Accuracy.Highest

// Balanced (default)
Location.Accuracy.High

// Lower accuracy (faster, less battery)
Location.Accuracy.Balanced
```

### **Disable Geofencing (Testing Only):**

```typescript
// Comment out the geofence check:
// if (!isWithinGeofence) { ... }
```

---

## 📊 **Example Calculations**

### **Inside Geofence:**
```
Hospital: 24.8607, 67.0011
User:     24.8620, 67.0015
Distance: 156 meters
Radius:   200 meters
Result:   156 <= 200 → ✅ ALLOWED
```

### **Outside Geofence:**
```
Hospital: 24.8607, 67.0011
User:     24.9100, 67.0500
Distance: 5432 meters (5.4 km)
Radius:   200 meters
Result:   5432 > 200 → ❌ BLOCKED
```

---

## 🔐 **Security Notes**

### **Strengths:**
- ✅ Prevents remote check-ins
- ✅ High GPS accuracy
- ✅ Real-time verification
- ✅ Per-branch configuration

### **Limitations:**
- ⚠️ Can be bypassed with GPS spoofing apps (rare)
- ⚠️ Requires GPS signal (doesn't work in bunkers)
- ⚠️ Might fail indoors (use larger radius)

### **Additional Security (Optional):**
- Add IP address verification
- Store GPS coordinates in database with attendance
- Alert admin if suspicious patterns detected

---

## 📝 **Code Files Modified**

| File | Changes |
|------|---------|
| `package.json` | Added `expo-location` |
| `app/(app)/attendance.tsx` | Added geofencing logic, location UI, validation |

---

## ✅ **Features Summary**

**Location Tracking:**
- ✅ Request permissions
- ✅ Get current GPS coordinates
- ✅ Display on screen

**Geofence Validation:**
- ✅ Calculate distance to hospital
- ✅ Compare with allowed radius
- ✅ Block attendance if outside

**User Interface:**
- ✅ Visual status indicator (Green/Red)
- ✅ Distance display in meters
- ✅ Disabled buttons when outside
- ✅ Retry option with fresh GPS check

**Debugging:**
- ✅ Console logs for location check
- ✅ Shows GPS coordinates in debug panel
- ✅ Distance calculation visible

---

## 🚀 **Next Steps**

1. **Get hospital coordinates** for ALL branches
2. **Update `BRANCH_LOCATIONS`** with real GPS
3. **Test at hospital location**
4. **Adjust radius** if needed (start with 500m, reduce to 200m)
5. **Deploy to production**

---

## 📞 **Support**

If geofencing doesn't work:

1. Check location permissions granted
2. Verify GPS coordinates are correct
3. Increase radius for testing
4. Check console logs for distance
5. Test outside building (better GPS signal)

---

**Geofencing is ready! Update the coordinates and test at your hospital!** 📍✅

