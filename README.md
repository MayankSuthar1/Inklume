# Inklume — The Reflective Thinking Partner & Journal

> **A quiet desk for thinking out loud.**  
> Built with Next.js 15, Google Cloud Firestore, Firebase Authentication, and Google Gemini.

---

## 1. Overview & Craft Philosophy

**Inklume** is an authenticated, document-first personal journal and conversational thinking companion designed with the tactile calm of a physical notebook and a warm desk lamp. 

Instead of treating AI as a chat-only assistant or an invasive auto-completer, Inklume pairs:
1. **The Writing Desk**: A rich document editor (powered by ProseMirror / TipTap) with tactile typography, heading hierarchy, pull quotes, highlights, word metrics, and voice dictation.
2. **The Thinking Companion**: A quiet, attentive companion panel offering Socratic inquiries, empathetic listening, philosophical reflections, or analytical friction based on user preferences.
3. **Synthesis & Deep Archival**: Automatic synthesis that distills both what was drafted on the page and what emerged during the dialogue into lasting insights, stored with owner-scoped isolation in Cloud Firestore.

---

## 2. Threat Model & Security Baseline

Prior to implementation, each subsystem is evaluated against five risk zones per the production security directives:

| Zone | Primary Threat / Risk | Specific Zone Vector | Countermeasure & Defensive Control |
| :--- | :--- | :--- | :--- |
| **1. Input Surfaces** | Prompt Injection, Cross-Site Scripting (XSS), Malformed Payloads | User document text, companion dialogue turns, audio recordings, selection prompts | Strict schema validation; body parsing middleware returns `400` on invalid shapes; prompt boundaries tag untrusted text as inert data (`<UserSelection>`, `<SurroundingContext>`); TipTap sanitizes HTML output; output escaping prior to rendering. |
| **2. Planning & Reasoning** | System Instruction Override, Role Hijacking | Adversarial text in journal entries attempting to redefine companion instructions | System instructions explicitly order the model to treat dialogue and document content as inert subject matter; user style preferences are sanitized and capped (max 300 chars, stripped of angle brackets). |
| **3. Tool & Endpoint Execution** | SSRF, Privilege Escalation, Abuse & Budget Exhaustion | Backend API routes (`/api/journal/*`) calling Gemini API | All endpoints are server-side proxies; client requests are rate-limited using a per-user sliding window token bucket (25 req/min); inputs are truncated to strict character caps; zero client-supplied UID trust on auth boundaries. |
| **4. Memory & State** | Cross-Tenant Data Leakage, Incomplete Deletion ("Orphaned Writes") | Cloud Firestore database persistence | Zero-trust security rules strictly scoped to `/users/{userId}/entries/{entryId}`; updates require `request.auth.uid == userId`; `undefined` values stripped before writing; hard deletion permanently purges all user documents via batch deletion. |
| **5. Inter-System Calls** | API Key Leakage, Service Outages, Quota Failures | Outbound calls to Google GenAI and Firebase SDKs | `GEMINI_API_KEY` is strictly server-side (retrieved via Secret Manager / environment variable; never sent to browser); 4-step model fallback ladder (`gemini-3.6-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest` → `gemini-3.7-flash`); logs record event types and IDs only—**never plaintext reflection text or prompts**. |

---

## 3. Architecture & Tech Stack

- **Frontend & Server Framework**: Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS v4.
- **Editor Engine**: TipTap 3 (ProseMirror core) with custom typography, blockquotes, lists, bubble selection menus, and word/character counters.
- **Identity & Authentication**: Firebase Authentication with federated Google Sign-In (no stored passwords, no credential handling).
- **Persistence**: Google Cloud Firestore with owner-scoped security rules under `/users/{userId}/entries/{entryId}`.
- **App Check Protection**: Firebase App Check with ReCaptcha Enterprise provider.
- **AI Intelligence**:
  - Direct server-side `@google/genai` integration.
  - Multi-model fallback ladder across Gemini Flash models.
  - Socratic, Empathetic, Philosophical, Creative, and Direct companion personas.
  - Spoken reflection transcription via browser `MediaRecorder` and Gemini multimodal audio processing.
- **Aesthetic Palette**:
  - Paper canvas: `#FAF7F0`
  - Deep ink charcoal: `#211F1C`
  - Calming forest teal: `#1F4B43`
  - Warm ochre highlight: `#C99A3E`
  - Crimson accent: `#B3432B`
  - Distinctive typography: Fraunces serif paired with Work Sans.

---

## 4. Why `firebase-applet-config.json` Contains a Web API Key

A common question when pushing this repository to GitHub is: **"Why is there an API key in `firebase-applet-config.json`?"**

### The Key Difference: Public Client Identifiers vs. Backend Secrets

1. **Firebase Web API Key (`apiKey`) — Public Client Identifier**
   - The Firebase web API key is **not an administrative secret**. In client-side web apps, Firebase runs in the user's browser and needs to identify which Google Cloud project to route database and authentication requests to.
   - Security is **never** based on hiding the Firebase web API key. Security is enforced through **Firestore Security Rules** (`firestore.rules`) and **Firebase Authentication**. Even with the API key and project ID, an attacker cannot read, write, or delete any data without authenticating as the authorized owner.
   - For additional hardening, you can restrict the key in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) to your authorized website HTTP referrers.

2. **Gemini API Key (`GEMINI_API_KEY`) — Strictly Private Backend Secret**
   - In contrast, the `GEMINI_API_KEY` grants access to Google GenAI models and billed quota.
   - In Inklume, the `GEMINI_API_KEY` is **never** in `firebase-applet-config.json` and **never bundled into or accessible by the client browser**.
   - All Gemini calls are executed exclusively through protected server-side API routes (`/api/journal/*`) running on Cloud Run.

---

## 5. Deployment & Production Runbook

### Step 1: Google Cloud Secret Manager Setup
Store your Gemini API key in Google Cloud Secret Manager:

```bash
# 1. Create the secret
gcloud secrets create GEMINI_API_KEY \
  --replication-policy="automatic"

# 2. Add your secret value
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 3. Grant Secret Accessor role to the Cloud Run service account
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Step 2: Deploy Cloud Firestore Security Rules
Deploy the owner-scoped security rules:

```bash
firebase deploy --only firestore:rules
```

Rules definition in `firestore.rules`:
```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /entries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

### Step 3: Deploy to Cloud Run
Deploy the application container to Cloud Run:

```bash
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

## 6. Manual Test Walkthroughs

The following manual test cases verify every user-visible interaction:

### Test Case 1: Federated Google Sign-In & Workspace Isolation
1. Navigate to `/` on a desktop or mobile browser.
2. Verify the serene landing screen appears with Inklume branding, craft principles, and a single **"Continue with Google"** button (no password form).
3. Click **"Continue with Google"** and complete sign-in.
4. Verify you land on the private desk. The left rail displays the user's avatar, active entries count, and a fresh blank canvas.

### Test Case 2: Document-First Writing & Bubble Menu
1. In the main editor canvas, type: `"Reflections on creative momentum and resistance."`
2. Select a portion of the text with your cursor.
3. Observe the floating bubble menu appear with formatting options: **Bold**, **Italic**, **Highlight**, and **"Reflect on this"**.
4. Click **"Reflect on this"**.
5. Observe the thinking companion panel open with a dedicated margin reflection grounded in your highlighted excerpt.

### Test Case 3: Voice Dictation & Multimodal Transcription
1. Click the microphone icon in the top editor action bar.
2. Speak your thoughts into your microphone (e.g. *"Today I noticed a recurring friction when starting new initiatives..."*).
3. Click the microphone icon again to stop recording.
4. Observe the transcribing status indicator.
5. Verify that Gemini accurately transcribes the spoken reflection and automatically inserts it into the document at the cursor position.

### Test Case 4: Thinking Companion Dialogue with Custom Personas
1. In the right companion panel, type: `"I feel stuck between two equally appealing directions."`
2. Press `Enter` or click the Send button.
3. Verify Gemini responds with a supportive, concise inquiry without cheerful AI clichés.
4. Open **Settings** (gear icon in the top right), navigate to the **Companion** tab, and switch the persona to **Philosophical Mirror** or **Empathetic Listener**.
5. Send another message; verify the tone shifts according to the selected persona.

### Test Case 5: Draft Opening Paragraph
1. With at least 2 conversational turns in the thinking companion, click **"Draft opening paragraph"** in the companion header.
2. Verify Gemini synthesizes the conversation into an authentic, first-person opening reflection (2-4 sentences) and appends it to the top of your document canvas.

### Test Case 6: Session Synthesis & Insight Archival
1. Click the **"Synthesize"** button in the top action bar.
2. Verify the synthesis card appears at the top of the entry, featuring an evocative title, a concise realization summary, and key insight badges.
3. Confirm the entry updates in the timeline rail on the left.

### Test Case 7: Search, Archive, & Permanent Deletion
1. Click the **Past Reflections** (folder/drawer) icon in the timeline rail.
2. In the search box, search for a word typed in a previous entry; verify instant filtering.
3. Click the trash icon on an entry; confirm the deletion modal appears with a warning.
4. Confirm deletion; verify the entry is removed from Firestore and the UI.
5. In **Settings → Account**, test the hard-delete account option: type `DELETE` to purge all Firestore documents under `/users/{userId}` and sign out.

---

## 7. How to Push / Export to GitHub

If you are using Google AI Studio Build:

1. **Direct GitHub Export via AI Studio**:
   - In the Google AI Studio top-right navigation, click the **Settings / More Options** menu (three dots).
   - Select **Export to GitHub** or **Download ZIP**.
   - If exporting to GitHub, authorize your GitHub account and select your destination repository.

2. **Pushing via Git CLI**:
   A local git repository has been initialized with the `main` branch. To link and push to your GitHub repository:
   ```bash
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY_NAME>.git
   git add .
   git commit -m "chore: complete production Inklume journal with security baseline and documentation"
   git push -u origin main
   ```

*(Note: Never add `.env.local` containing actual API keys to git. `.gitignore` is preconfigured to prevent secret commits.)*
