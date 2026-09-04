# Inklume — The Reflective Notebook

An authenticated web application for brainstorming and reflective journaling with Gemini, crafted with the tactile atmosphere of a well-made notebook and a good desk lamp.

---

## Architecture & Tech Stack

- **Frontend**: Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS v4.
- **Identity**: Firebase Authentication with federated Google Sign-In (no stored passwords).
- **Database**: Cloud Firestore with strict per-user owner-scoped partition rules.
- **Abuse Protection**: Firebase App Check support with graceful fallback.
- **AI Engine**: Server-side Gemini API with an automatic 4-model fallback ladder (`gemini-3.6-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest` → `gemini-3.7-flash`) and per-user rate limiting.
- **Design Philosophy**: Warm paper (`#F5F1E8`), ink charcoal (`#211F1C`), deep ink-teal (`#1F4B43`), sparing ochre highlight (`#C99A3E`), characterful Fraunces serif for reflections, and Work Sans for chrome.

---

## 1. Prerequisites & Environment Setup

### Environment Variables (`.env`)
```bash
# GEMINI_API_KEY: Secret key accessed only server-side
GEMINI_API_KEY="your-gemini-api-key"

# APP_URL: Base URL of the application
APP_URL="https://your-service-url.run.app"
```

### Google Cloud Secret Manager Setup
To securely manage the Gemini API key in Cloud Run:

```bash
# 1. Create the secret in Secret Manager
gcloud secrets create GEMINI_API_KEY \
  --replication-policy="automatic"

# 2. Add the API key secret payload
echo -n "YOUR_ACTUAL_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 3. Grant the Cloud Run compute service account access
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 2. Cloud Firestore Security Rules (`firestore.rules`)

Personal journal entries are strictly partitioned under `/users/{userId}/entries/{entryId}`:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Isolated user partition: only authenticated user can read/write their own tree
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /entries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

To deploy rules from CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 3. Production Build & Cloud Run Deployment

Build and deploy the containerized service directly to Cloud Run:

```bash
# Build & Deploy to Cloud Run
gcloud run deploy personal-gemini-journal \
  --source . \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --labels="app=personal-gemini-journal,tier=production"
```

---

## 4. Manual Test Walkthroughs

### Test 1: Federated Google Sign-In & Isolated Partition
1. Open the landing page at `/`.
2. Verify the landing screen displays the serene desk welcome and a **Continue with Google** button (no password form).
3. Click **Continue with Google** and complete authentication.
4. Verify you land on the private dashboard with an active writing desk and empty timeline rail.

### Test 2: Multi-turn Reflection with Fallback Ladder
1. Click the textarea on the desk and type: `"I am weighing whether to pivot our product focus this quarter."`
2. Press `Enter` (or click the Send ink button).
3. Observe the user turn immediately appear on the desk.
4. Observe the quiet pulsing dot indicator while Gemini reflects.
5. Notice the arrival of Gemini's response with a soft fade-and-2px-rise animation.
6. Reply with a follow-up: `"The main hesitation is our existing user commitments."`
7. Confirm multi-turn history flows naturally without flickering or page refresh.

### Test 3: Session Synthesis & Key Insights
1. Click the **Synthesize** button in the top action bar (active after 2 or more turns).
2. Gemini summarizes the session in the background.
3. Verify the synthesized card appears with a characterful title, an italicized 2-3 sentence synthesis, and untangled bullet points marked with the sparing ochre badge.

### Test 4: Archive Drawer & Full-Text Search
1. Click the notebook icon (or **Past Reflections**) in the top right or timeline rail.
2. Verify the archive drawer slides in from the right edge.
3. Type keywords into the search box.
4. Confirm entries filter dynamically by title, summary, or turn content.
5. Click on an entry to switch the writing desk to that session.

### Test 5: Permanent Single Entry Deletion
1. Open an entry or locate it in the drawer / top bar.
2. Click the trash icon.
3. Verify the deletion confirmation modal displays with clear warning text in red-brown (`#B3432B`).
4. Click **Delete entry**.
5. Confirm the document is permanently deleted from Firestore and removed from the timeline rail.

### Test 6: Complete Account & Data Hard Deletion
1. In the timeline rail footer or archive drawer, click **Delete my account & data**.
2. Verify the confirmation modal demands typing `DELETE` for verification.
3. Type `DELETE` and confirm.
4. Verify all documents in `/users/{userId}/entries` and `/users/{userId}` are deleted via Firestore batch deletion, the user is signed out, and the UI returns to the landing page.
