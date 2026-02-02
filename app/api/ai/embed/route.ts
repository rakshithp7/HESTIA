import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
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
    console.error('Embedding error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate embedding',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
