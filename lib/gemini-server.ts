import { GoogleGenAI } from '@google/genai';

// Fallback ladder as strictly specified in Directive 5:
// gemini-3.6-flash → gemini-3.1-flash-lite → gemini-flash-latest → gemini-3.7-flash
const MODEL_FALLBACK_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
] as const;

// In-memory token bucket / sliding window rate limiter keyed by UID
// Limits each user to 25 requests per minute
interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitBucket>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 25;

export function checkRateLimit(userId: string): { allowed: boolean; retryAfterSec?: number } {
  if (!userId) return { allowed: false, retryAfterSec: 60 };

  const now = Date.now();
  const bucket = rateLimitMap.get(userId);

  if (!bucket || now > bucket.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  bucket.count += 1;
  return { allowed: true };
}

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

// Check if error status is retryable
function isRetryableError(error: any): boolean {
  if (!error) return false;
  const status = error.status || error.statusCode || (error.response && error.response.status);
  if ([503, 429, 500, 404].includes(Number(status))) return true;

  const msg = (error.message || '').toLowerCase();
  return (
    msg.includes('overloaded') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('resource exhausted') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('not found')
  );
}

const JOURNAL_SYSTEM_INSTRUCTION = `You are a quiet, reflective thinking partner for a personal journal. 
Your role is to help the user think out loud, untangle complex emotions, brainstorm ideas, and find clarity.

Core Persona & Directives:
1. Tone: Warm, thoughtful, attentive, unhurried, and human. Avoid bubbly cheerleading, clinical detachment, or generic robotic summaries.
2. Form: Keep responses concise (1 to 3 short paragraphs). Prioritize asking one sharp, open-ended question that helps them explore deeper, or reflecting back a recurring theme or contradiction gently.
3. Anti-Slop: Do not use generic buzzwords ("supercharge", "journey", "dive deep"). Never lecture or prescribe rigid five-step solutions unless asked.
4. Crisis Directive: If the user's reflections indicate acute crisis, thoughts of self-harm, or severe danger, remain deeply supportive and encourage reaching out to a trusted loved one, counselor, or 24/7 crisis service (such as dialing 988 or contacting local emergency services). Never attempt to medically diagnose or treat, and never act dismissive.`;

export async function runGeminiWithFallback({
  userId,
  contents,
  systemInstruction = JOURNAL_SYSTEM_INSTRUCTION,
  responseSchema,
  responseMimeType,
}: {
  userId: string;
  contents: any;
  systemInstruction?: string;
  responseSchema?: any;
  responseMimeType?: string;
}): Promise<{ text: string; modelUsed: string }> {
  const ai = getGenAI();
  const startTime = Date.now();
  let lastError: any = null;

  for (let i = 0; i < MODEL_FALLBACK_LADDER.length; i++) {
    const model = MODEL_FALLBACK_LADDER[i];
    try {
      // Directive 7: Log only event types and model metadata; NEVER log user content or prompts
      console.info(JSON.stringify({
        event: 'gemini_call_attempt',
        model,
        attempt: i + 1,
        userRef: userId ? `${userId.substring(0, 4)}...` : 'anonymous',
      }));

      const config: any = {
        systemInstruction,
        temperature: 0.7,
      };

      if (responseMimeType) {
        config.responseMimeType = responseMimeType;
      }
      if (responseSchema) {
        config.responseSchema = responseSchema;
      }

      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });

      const responseText = response.text || '';

      console.info(JSON.stringify({
        event: 'gemini_call_success',
        model,
        durationMs: Date.now() - startTime,
        attempts: i + 1,
      }));

      return {
        text: responseText,
        modelUsed: model,
      };
    } catch (err: any) {
      lastError = err;
      const retryable = isRetryableError(err);
      console.warn(JSON.stringify({
        event: 'gemini_call_fail',
        model,
        attempt: i + 1,
        retryable,
        status: err?.status || 'unknown',
      }));

      // If retryable and not at end of ladder, advance to next model
      if (retryable && i < MODEL_FALLBACK_LADDER.length - 1) {
        continue;
      }
      // If it's the last model or not retryable, rethrow
      break;
    }
  }

  throw new Error(
    `Gemini request failed across fallback models: ${lastError?.message || 'Service unavailable'}`
  );
}

