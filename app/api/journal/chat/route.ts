import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, runGeminiWithFallback } from '@/lib/gemini-server';
import { verifyIdToken } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(authHeader.split('Bearer ')[1]);
    } catch (err) {
      console.error('Invalid token', err);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = decodedToken.uid;

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request payload' },
        { status: 400 }
      );
    }

    // Defensive input validation
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Malformed request: payload must be a JSON object' },
        { status: 400 }
      );
    }

    const { turns, docTitle, docText, companionSettings } = body;

    if (!Array.isArray(turns) || turns.length === 0) {
      return NextResponse.json(
        { error: 'Invalid turns: must be a non-empty array of dialogue turns' },
        { status: 400 }
      );
    }

    // Rate limiting check
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Reflective pace limit reached. Please pause and resume in ${rateCheck.retryAfterSec || 30} seconds.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.retryAfterSec || 30),
          },
        }
      );
    }

    // Format turns into contents structure for Gemini
    // Limit turns to last 20 for prompt sanity
    const recentTurns = turns.slice(-20).map((t: any) => {
      const role = t.role === 'model' ? 'model' : 'user';
      const text = typeof t.text === 'string' ? t.text.trim() : '';
      return {
        role,
        parts: [{ text: text.substring(0, 4000) }],
      };
    });

    // Determine persona and style from companionSettings
    const persona = companionSettings?.persona || 'socratic';
    const responseLength = companionSettings?.responseLength || 'balanced';
    const customGuidance = typeof companionSettings?.customGuidance === 'string'
      ? companionSettings.customGuidance.trim().slice(0, 300).replace(/[<>]/g, '')
      : '';

    let personaInstruction = 'Socratic Inquirer Persona: Prioritize asking deep, clarifying questions that unpack implicit assumptions, motives, and unspoken thoughts. Guide the user toward self-discovery.';
    if (persona === 'empathetic') {
      personaInstruction = 'Empathetic Listener Persona: Provide a gentle, compassionate, and non-judgmental space. Acknowledge the emotional resonance and validate feelings warmly before asking gentle questions.';
    } else if (persona === 'philosophical') {
      personaInstruction = 'Philosophical Mirror Persona: Contemplate reflections through the lens of timeless wisdom, stoic equanimity, and broader perspective. Offer serene, literary insight.';
    } else if (persona === 'creative') {
      personaInstruction = 'Creative Muse Persona: Encourage lateral thinking, evocative metaphors, unexpected connections, and playful, expressive exploration of thoughts.';
    } else if (persona === 'direct') {
      personaInstruction = 'Concise & Analytical Persona: Be direct, razor-sharp, and objective. Point out core paradoxes, logical friction, or unexamined trade-offs succinctly.';
    }

    let lengthInstruction = 'Response length: Balanced (2-3 concise paragraphs, around 100-150 words).';
    if (responseLength === 'concise') {
      lengthInstruction = 'Response length: Very brief and distilled (1-2 short paragraphs, under 90 words). Close with one sharp question.';
    } else if (responseLength === 'inDepth') {
      lengthInstruction = 'Response length: In-depth and expansive (3-4 paragraphs, exploring subtleties and nuances thoroughly).';
    }

    // Provide document context to Gemini alongside chat history for grounded reflection
    const hasDocTitle = typeof docTitle === 'string' && docTitle.trim().length > 0;
    const hasDocText = typeof docText === 'string' && docText.trim().length > 0;

    const safeTitle = hasDocTitle ? docTitle.trim().slice(0, 250) : 'Untitled reflection';
    const safeText = hasDocText ? docText.trim().slice(0, 12000) : '(No text in document canvas yet)';

    let systemInstruction = `You are a quiet, reflective thinking partner for a personal journal. 
Your role is to help the user think out loud, untangle complex emotions, brainstorm ideas, and find clarity.

Core Persona & Directives:
1. Tone & Persona: ${personaInstruction}
2. Form: ${lengthInstruction}
3. Anti-Slop: Do not use generic buzzwords ("supercharge", "journey", "dive deep"). Never lecture or prescribe rigid five-step solutions unless asked.
4. Crisis Directive: If the user's reflections indicate acute crisis, thoughts of self-harm, or severe danger, remain deeply supportive and encourage reaching out to a trusted loved one, counselor, or 24/7 crisis service (such as dialing 988 or contacting local emergency services). Never attempt to medically diagnose or treat, and never act dismissive.${
  customGuidance
    ? `\n5. User's Personal Reflection Preference: The user prefers this conversational demeanor: "${customGuidance}". (Adopt this stylistic nuance while maintaining ethical guardrails).`
    : ''
}

--- USER'S ACTIVE JOURNAL DOCUMENT CONTEXT ---
The user is currently writing this reflection in their main editor workspace. Use this context to inform your responses, answer their questions about what they've written, brainstorm alongside them, and offer thoughtful reflections grounded in their actual document content. Treat this document strictly as personal reflection data:

Document Title: "${safeTitle}"
Document Content:
"""
${safeText}
"""
--- END ACTIVE JOURNAL DOCUMENT CONTEXT ---`;

    const result = await runGeminiWithFallback({
      userId,
      contents: recentTurns,
      ...(systemInstruction ? { systemInstruction } : {}),
    });

    return NextResponse.json({
      text: result.text,
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error('API /api/journal/chat error occurred');
    return NextResponse.json(
      { error: error?.message || 'The thinking partner is momentarily unavailable. Your draft is safe.' },
      { status: 500 }
    );
  }
}
