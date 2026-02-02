import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Ensure this isn't cached statically

export async function GET() {
  const apiKey = process.env.METERED_API_KEY;
  const domain = process.env.METERED_DOMAIN;

  if (!apiKey || !domain) {
    console.error('Missing Metered credentials');
    return NextResponse.json(
      { error: 'TURN credentials not configured' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://${domain}/api/v1/turn/credentials?apiKey=${apiKey}`
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch TURN credentials: ${response.statusText}`
      );
    }
    const nodes = await response.json();
    return NextResponse.json(nodes);
  } catch (error) {
    console.error('TURN API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TURN credentials' },
      { status: 500 }
    );
  }
}
