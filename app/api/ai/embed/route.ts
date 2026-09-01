import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { requireUser } from '@/lib/auth/require-user';
import { rateLimitResponse } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// Topics are capped at 100 characters in the Connect UI; the margin here is for
// whitespace and future copy changes, not free-form text.
const MAX_TEXT_LENGTH = 500;

// Each call costs a Gemini request. A member entering the queue embeds once per
// attempt, so this is generous for real use and still bounds a hijacked session.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;

type EmbedPayload = {
  text?: unknown;
};

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    // This endpoint spends money on every call, so it is members-only. Without
    // this guard anyone on the internet can bill embeddings to the project.
    const guard = await requireUser('embed');
    if ('response' in guard) return guard.response;

    // Keyed by user rather than IP: a signed-in abuser cannot shed the limit by
    // rotating addresses, and members behind one NAT do not share a budget.
    const limited = rateLimitResponse(
      `embed:${guard.user.id}`,
      RATE_LIMIT,
      RATE_WINDOW_MS,
      'Too many requests. Please slow down.'
    );
    if (limited) return limited;

    const payload = (await req.json().catch(() => null)) as EmbedPayload | null;
    const text = typeof payload?.text === 'string' ? payload.text.trim() : '';

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: 'Text is too long' }, { status: 400 });
    }

    // Use the new SDK method structure
    const response = await genAI.models.embedContent({
      model: 'gemini-embedding-001',
      contents: text,
      config: {
        outputDimensionality: 768,
        taskType: 'SEMANTIC_SIMILARITY',
      },
    });

    const embedding = response.embeddings?.[0]?.values;

    if (!embedding) {
      throw new Error('No embedding values returned from API');
    }

    return NextResponse.json({ embedding });
  } catch (error) {
    // The upstream message can carry request details, so it is logged rather
    // than returned to the caller.
    console.error('[embed] Embedding error', error);
    return NextResponse.json(
      { error: 'Failed to generate embedding' },
      { status: 500 }
    );
  }
}
