import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
    try {
        const { text } = await req.json();

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
        const result = await model.embedContent({
            content: { role: 'user', parts: [{ text }] },
            outputDimensionality: 768
        } as any);
        const embedding = result.embedding.values;

        return NextResponse.json({ embedding });
    } catch (error) {
        console.error('Embedding error:', error);
        return NextResponse.json(
            { error: 'Failed to generate embedding', details: (error as Error).message },
            { status: 500 }
        );
    }
}
