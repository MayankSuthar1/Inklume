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

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Malformed request: payload must be a JSON object' },
        { status: 400 }
      );
    }

    const { turns, docTitle, docText, text } = body;

    // Prepare Document context (title & content)
    const rawTitle = typeof docTitle === 'string' ? docTitle.trim() : '';
    const rawDocText = typeof docText === 'string' ? docText.trim() : (typeof text === 'string' ? text.trim() : '');
    const cleanDocText = rawDocText.slice(0, 15000);
    const hasDocContent = cleanDocText.length > 0;

    // Prepare Thinking Companion dialogue turns context
    const validTurns = Array.isArray(turns)
      ? turns.filter((t: any) => t && typeof t.text === 'string' && t.text.trim())
      : [];
    const hasTurns = validTurns.length > 0;

    if (!hasDocContent && !hasTurns) {
      return NextResponse.json(
        { error: 'Nothing to synthesize yet. Write in the document or dialogue with the companion first.' },
        { status: 400 }
      );
    }

    // Check rate limit
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Synthesis rate limit reached. Please wait ${rateCheck.retryAfterSec || 30}s.` },
        { status: 429 }
      );
    }

    // Format conversation turns for prompt
    const transcript = hasTurns
      ? validTurns
          .map((t: any) => `${t.role === 'user' ? 'Author' : 'Thinking Companion'}: ${t.text.trim()}`)
          .join('\n\n')
      : '(No dialogue recorded)';

    const prompt = `Synthesize a comprehensive personal journal reflection using both the written document draft and the thinking companion dialogue history.
Integrate insights across both sources: what was drafted on the page, and what unfolded, shifted, or clarified during the dialogue.

Document Title: "${rawTitle || 'Untitled reflection'}"

Document Content:
"""
${hasDocContent ? cleanDocText : '(No document canvas text)'}
"""

Thinking Companion Dialogue History:
"""
${transcript}
"""

Distill this into a thoughtful, deeply resonant reflection.
Return ONLY valid JSON matching this exact structure:
{
  "title": "A characterful, evocative 3-6 word title capturing the heart of this reflection (suggest one or refine existing title)",
  "summary": "A 2-3 sentence deeply reflective core insight capturing the author's primary realization, emotional shift, or synthesis across their writing and dialogue",
  "keyInsights": [
    "Specific nuance, realization, or tension untangled",
    "Open reflective question or guiding thought to carry forward"
  ]
}`;

    const summarizeSystemInstruction = `You are a quiet, empathetic, high-depth thinking partner and archivist for personal journals.
Analyze both the author's written document draft and their thinking companion dialogue history with emotional nuance and philosophical clarity.
Extract authentic reflections, avoiding generic motivational platitudes, superficial lists, or AI clichés ("dive deep", "embrace the journey", "supercharge").
Always output pure valid JSON without markdown wrapping.`;

    const result = await runGeminiWithFallback({
      userId,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: summarizeSystemInstruction,
    });

    let cleanedText = result.text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanedText);
    } catch {
      // Fallback if formatting was loose
      parsed = {
        title: 'Reflective Session',
        summary: cleanedText.substring(0, 300),
        keyInsights: [],
      };
    }

    return NextResponse.json({
      title: parsed.title || 'Untitled Reflection',
      summary: parsed.summary || '',
      keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error('API /api/journal/summarize error occurred');
    return NextResponse.json(
      { error: error?.message || 'Unable to synthesize summary at this moment.' },
      { status: 500 }
    );
  }
}
