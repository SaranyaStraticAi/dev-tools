import { NextResponse } from 'next/server';

export async function GET() {
  const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL;
  const apiToken = process.env.GRAFANA_API_TOKEN;

  if (!grafanaUrl || !apiToken) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Grafana configuration is missing',
        configured: false,
      },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${grafanaUrl}/api/health`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 60 }, // Cache for 1 minute
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Grafana service is not responding correctly',
          httpStatus: response.status,
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      status: 'healthy',
      grafanaStatus: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to connect to Grafana service',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
