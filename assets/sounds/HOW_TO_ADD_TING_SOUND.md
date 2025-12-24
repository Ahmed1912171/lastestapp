# How to Add "Ting" Sound

## Quick Steps:

1. **Download a "ting" or bell sound:**
   - Visit: https://notificationsounds.com/
   - Search for "bell" or "ting" or "chime"
   - Download a `.wav` file

2. **Save the file:**
   - Rename it to `ting.wav`
   - Place it in: `assets/sounds/ting.wav`

3. **Rebuild your app:**
   ```bash
   npx expo run:android
   # or
   npx expo run:ios
   ```

## Recommended "Ting" Sounds:

- **Bell**: https://notificationsounds.com/notification-sounds/bell-1
- **Chime**: https://notificationsounds.com/notification-sounds/chime-1
- **Ting**: https://notificationsounds.com/notification-sounds/ting-1

## File Requirements:
- Format: `.wav` (best compatibility)
- Duration: 1-2 seconds
- Size: Under 500KB

## Alternative: Use Default Sound Temporarily

If you want to test without adding a file, change `'ting.wav'` to `'default'` in `profile.tsx`.

