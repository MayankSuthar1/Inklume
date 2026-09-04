# Inklume — The Reflective Thinking Partner & Journal

> **A quiet desk for thinking out loud.**  
> Inklume is an authenticated, document-first personal journal and conversational companion designed to help you untangle thoughts, explore ideas, and capture enduring reflections.

---

## About the Project

Most journaling apps either treat writing as a solitary, blank-page chore or reduce AI to an invasive autocomplete chatbot that writes *for* you.

**Inklume** takes a different path. It is built as a quiet desk inspired by tactile stationery and warm desk lighting. Here, writing remains document-first: you write your own words, while a gentle, non-intrusive thinking companion sits quietly beside the page. The companion asks thoughtful questions, highlights patterns, and offers fresh perspectives—serving as a sounding board rather than a ghostwriter.

When you finish a writing session, Inklume distills your writing and conversation into concise insights, archiving your personal growth securely in the cloud.

---

## Key Features & Capabilities

### 1. Document-First Writing Desk
- **Distraction-Free Typography**: A spacious, distraction-free canvas powered by ProseMirror and TipTap, featuring serif headings, clean body formatting, and generous margins.
- **Rich Formatting Toolbar**: Easy-access controls for headings (H1, H2, H3), blockquotes, bulleted lists, numbered lists, task checkboxes, code blocks, and horizontal rules.
- **Live Metrics**: Real-time word count, character count, and estimated reading time tracked unobtrusively at the bottom of the page.
- **Auto-Save**: Changes persist continuously to your private Cloud Firestore vault as you write.

### 2. Contextual Bubble Menu & Inline Reflection
- **Highlight-to-Reflect**: Highlight any sentence or paragraph in your text to trigger a floating menu with instant formatting tools (Bold, Italic, Strikethrough, Highlight).
- **"Reflect on this"**: Send a specific excerpt to the companion with one click. The companion leaves a targeted margin note or open question focused solely on that highlighted passage.

### 3. Spoken Voice Reflections
- **Universal Audio Dictation**: Speak your thoughts freely using standard browser audio recording (`MediaRecorder`).
- **Gemini Multimodal Transcription**: Spoken recordings are transcribed with proper punctuation and capitalization via Google Gemini's multimodal audio models, then inserted directly at your cursor position in the document.

### 4. The Socratic Thinking Companion
- **A Dialogue Partner Beside the Desk**: A collapsible side panel where you can converse about the ideas developing on the page.
- **Thoughtful Inquiries**: Instead of generic pleasantries or generic answers, the companion asks clarifying questions, uncovers unexamined assumptions, and helps you explore deeper motives.
- **"Draft Opening Paragraph"**: If you have talked through an idea in the companion panel but haven't started typing on the page, click one button to have the companion synthesize the conversation into an authentic first-person opening reflection.

### 5. Companion Stances & Personas
Tailor the companion's tone to match your headspace:
- **Socratic Partner**: Gently questions assumptions, asks for definitions, and probes for contradictions.
- **Empathetic Listener**: Validates emotions, mirrors feelings with warmth, and creates a safe emotional container.
- **Philosophical Mirror**: Connects your personal reflections to timeless philosophical ideas, paradoxes, and ethical questions.
- **Creative Divergence**: Suggests lateral connections, metaphors, counterfactuals, and alternative angles.
- **Direct Pragmatist**: Focuses on root causes, decisions, trade-offs, and actionable next steps.
- **Custom Guidance**: Add your own custom behavioral rules (e.g. *"Speak briefly in one or two sentences"* or *"Help me prepare for difficult conversations"*).

### 6. Reflection Synthesis & Key Insights
- **One-Click Synthesis**: Click the **Synthesize** button to analyze your completed writing session and companion dialogue.
- **Automatic Titling**: Generates an evocative, contextual title for your entry.
- **Executive Realization Summary**: Formulates a concise 2–3 sentence distillation of what you realized or learned during the session.
- **Key Insight Badges**: Extracts key takeaways and mood tags for effortless recall when reviewing past entries.

### 7. Timeline Rail & Reflection Archive
- **Historical Timeline**: Browse past entries grouped chronologically by date in a clean side rail.
- **Instant Search**: Search through previous entries by title, text content, or insight tags.
- **Archive & Restore**: Move past reflections into an archive view when you want a clean view of your active reflections.
- **Permanent Deletion**: Individual entries can be permanently deleted with a confirmation safety prompt.

### 8. Privacy & Data Ownership
- **Federated Google Authentication**: Sign in securely with your Google account. No passwords are created, handled, or stored.
- **Owner-Isolated Firestore Storage**: Every entry is stored under your authenticated user ID (`/users/{userId}/entries/{entryId}`) and protected by strict database security rules.
- **Zero Third-Party Training**: Your private thoughts are never shared with public databases or model training sets.
- **Hard Account Deletion**: The settings dialog includes an option to wipe your entire account and all associated documents permanently from Cloud Firestore.

---

## How to Use Inklume

### Writing Your First Entry
1. **Sign In**: Launch the app and click **Continue with Google**.
2. **Start on the Page**: Begin typing your thoughts directly on the writing canvas. Use the top toolbar to structure headings, lists, or blockquotes.
3. **Talk It Out**: If you hit a roadblock or want to explore an idea further, toggle open the **Thinking Companion** panel on the right and share what is on your mind.
4. **Highlight & Inquire**: Highlight any passage you wrote and click **Reflect on this** to get a margin observation from the companion.
5. **Synthesize & Save**: When you feel finished, click **Synthesize** to generate key insights and tags. Your entry is saved automatically.

### Adjusting Companion Personas
1. Click the **Settings** (gear icon) in the top-right header.
2. Select the **Companion** tab.
3. Choose your preferred persona (e.g. *Philosophical Mirror* or *Direct Pragmatist*) or input your own custom instructions.
4. Close settings—future conversations will adapt to your selected tone.

---

## Technical Architecture

- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router) & [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Editor Engine**: [TipTap](https://tiptap.dev/) / [ProseMirror](https://prosemirror.net/)
- **Database & Auth**: [Google Cloud Firestore](https://firebase.google.com/docs/firestore) & [Firebase Authentication](https://firebase.google.com/docs/auth)
- **AI Engine**: [Google Gemini Flash Models](https://ai.google.dev/) via the official `@google/genai` SDK
- **Icons**: [Lucide React](https://lucide.dev/)

---

## Getting Started (Local Development)

### 1. Prerequisites
- Node.js 20+
- A Google Cloud / Firebase project with Firestore and Google Sign-In enabled.
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/).

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY_NAME>.git
cd personal-gemini-journal

# Install dependencies
npm install
```

### 3. Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env.local
```

Populate `.env.local` with your configuration:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Run the Dev Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to start journaling.
