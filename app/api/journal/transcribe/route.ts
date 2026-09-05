import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/gemini-server';
import { verifyIdToken } from '@/lib/firebase-admin';

// Lazy initialization of GoogleGenAI SDK
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }
    genAIClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// Model ladder per Directive 5:
// gemini-3.6-flash → gemini-3.1-flash-lite → gemini-flash-latest → gemini-3.7-flash
const TRANSCRIBE_MODEL_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
] as const;

function isRetryable(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.statusCode || (err.response && err.response.status);
  if ([503, 429, 500, 404].includes(Number(status))) return true;
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('overloaded') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('resource exhausted') ||
    msg.includes('temporarily unavailable')
  );
}

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

    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Please try again in ${rateCheck.retryAfterSec || 30} seconds.` },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided.' }, { status: 400 });
    }

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Audio file is empty.' }, { status: 400 });
    }
    
    let mimeType = audioFile.type || 'audio/webm';
    if (mimeType.includes('webm')) mimeType = 'audio/webm';
    else if (mimeType.includes('mp4')) mimeType = 'audio/mp4';
    else if (mimeType.includes('ogg')) mimeType = 'audio/ogg';
    else if (mimeType.includes('wav')) mimeType = 'audio/wav';

    const ai = getGenAI();
    let lastError: any = null;

    for (let i = 0; i < TRANSCRIBE_MODEL_LADDER.length; i++) {
      const model = TRANSCRIBE_MODEL_LADDER[i];
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              inlineData: {
                mimeType,
                data: buffer.toString('base64'),
              },
            },
            'Transcribe this spoken audio accurately. Output only the transcribed speech with proper punctuation and capital letters. Do not add any preface, commentary, conversational filler, or formatting tags.',
          ],
          config: {
            temperature: 0.1,
          },
        });

        const text = (response.text || '').trim();
        return NextResponse.json({ text, modelUsed: model });
      } catch (err: any) {
        lastError = err;
        console.warn(`Transcribe model ${model} failed:`, err?.message || err);
        if (isRetryable(err) && i < TRANSCRIBE_MODEL_LADDER.length - 1) {
          continue;
        }
        break;
      }
    }

    throw lastError || new Error('Transcription service currently unavailable.');
  } catch (err: any) {
    console.error('Transcription API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to transcribe audio' }, { status: 500 });
  }
}
