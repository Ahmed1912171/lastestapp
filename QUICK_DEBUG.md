# 🔍 Quick Debug Checklist

## Check These Things:

### 1. **Backend Server Running?**
```bash
node servermerged2.js
# Should show: 🚀 Server running on http://0.0.0.0:3000
```

### 2. **Can you login?**
- Username: 1462
- Password: 130481-0429
- Does it navigate to home screen?

### 3. **What do you see on Attendance tab?**

**Debug Panel (Yellow Box) shows:**
```
isPresent: ?
hasTimeOut: ?
pinNumber: ?
```

### 4. **Console Errors?**

**Frontend (React Native):**
- Open debugger
- Any red errors?
- What logs do you see?

**Backend (Terminal):**
- Any errors in red?
- What was the last message?

### 5. **Network Issue?**

**Test backend:**
```
Open browser: http://192.168.100.117:3000/
Should show: {"status":"✅ Server running","time":"..."}
```

## Common Issues:

### Issue A: "PinNumber not found"
**Fix:** Re-login to get fresh session data

### Issue B: Check Out button gray/disabled
**Debug Panel should show:**
```
isPresent: true
hasTimeOut: false
Can Click Check Out: true  ← Should be true!
```

### Issue C: No data loading
**Check:** Is pinNumber showing in debug panel?

### Issue D: Server not responding
**Check:** IP address correct? (192.168.100.117:3000)

---

## Quick Test:

1. Open browser: `http://192.168.100.117:3000/admin`
2. Do you see data?
3. If NO → Server or network issue
4. If YES → Check frontend logs

