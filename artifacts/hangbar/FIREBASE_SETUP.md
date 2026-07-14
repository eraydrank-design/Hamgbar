# Firebase Setup Guide — HangBar

The app is configured to use Firebase project `hangbar-be018`.  
**Neither Firestore nor Firebase Storage has been created yet.**  
Follow the steps below exactly; the app will not work until both are done.

---

## Step 1 — Create Firestore Database

1. Open [Firebase Console](https://console.firebase.google.com/project/hangbar-be018/firestore)
2. Click **Create database**
3. Choose **Start in production mode** (the rules below will open it correctly)
4. Select a region — choose **europe-west** for best latency from Turkey
5. Click **Enable**

---

## Step 2 — Deploy Firestore Security Rules

Two options:

### Option A — Firebase CLI (recommended)
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules --project hangbar-be018
```
> The `firestore.rules` file in this directory is already written correctly.

### Option B — Firebase Console (manual)
1. Open [Firestore Rules](https://console.firebase.google.com/project/hangbar-be018/firestore/rules)
2. Replace the entire content with what is in `firestore.rules`
3. Click **Publish**

---

## Step 3 — Enable Firebase Storage

1. Open [Firebase Console → Storage](https://console.firebase.google.com/project/hangbar-be018/storage)
2. Click **Get started**
3. Choose **Start in production mode**
4. Select the same region as Firestore (**europe-west**)
5. Click **Done**

---

## Step 4 — Deploy Storage Security Rules

### Option A — Firebase CLI
```bash
firebase deploy --only storage:rules --project hangbar-be018
```
> The `storage.rules` file in this directory is already written correctly.

### Option B — Firebase Console (manual)
1. Open [Storage Rules](https://console.firebase.google.com/project/hangbar-be018/storage/hangbar-be018.firebasestorage.app/rules)
2. Replace the entire content with what is in `storage.rules`
3. Click **Publish**

---

## Step 5 — Enable Authentication Providers

1. Open [Firebase Console → Authentication](https://console.firebase.google.com/project/hangbar-be018/authentication/providers)
2. Enable **Email/Password**
3. Enable **Google** (set support email)

---

## Verification

After completing setup, log in to the app with `eraydrank@gmail.com`.  
The admin panel's **Sistem Durumu** section will show green checkmarks for Firestore and Storage.

---

## Environment Variables (already configured in Replit)

| Variable | Value |
|---|---|
| `VITE_FIREBASE_PROJECT_ID` | `hangbar-be018` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `hangbar-be018.firebasestorage.app` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `hangbar-be018.firebaseapp.com` |
| `VITE_FIREBASE_API_KEY` | *(set in Replit secrets)* |
| `VITE_FIREBASE_APP_ID` | *(set in Replit secrets)* |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | *(set in Replit secrets)* |
