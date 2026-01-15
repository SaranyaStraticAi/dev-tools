import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { endpoint, accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 401 }
      );
    }

    const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL;

    if (!grafanaUrl) {
      return NextResponse.json(
        { error: 'Grafana URL not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${grafanaUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Grafana API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Grafana proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request to Grafana' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const endpoint = searchParams.get('endpoint');
  const accessToken = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Access token is required' },
      { status: 401 }
    );
  }

  if (!endpoint) {
    return NextResponse.json(
      { error: 'Endpoint is required' },
      { status: 400 }
    );
  }

  const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL;

  if (!grafanaUrl) {
    return NextResponse.json(
      { error: 'Grafana URL not configured' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${grafanaUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Grafana API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Grafana proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request to Grafana' },
      { status: 500 }
    );
  }
}
