import { NextResponse } from 'next/server';

export async function GET() {
  const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL;
  const apiToken = process.env.GRAFANA_API_TOKEN;

  if (!grafanaUrl || !apiToken) {
    return NextResponse.json(
      { error: 'Grafana configuration is missing' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${grafanaUrl}/api/search?type=dash-db`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch dashboards from Grafana' },
        { status: response.status }
      );
    }

    const dashboards = await response.json();

    // Transform the response to only include necessary fields
    const simplifiedDashboards = dashboards.map((dashboard: {
      uid: string;
      title: string;
      uri: string;
      url: string;
      type: string;
      tags: string[];
      isStarred: boolean;
    }) => ({
      uid: dashboard.uid,
      title: dashboard.title,
      uri: dashboard.uri,
      url: dashboard.url,
      type: dashboard.type,
      tags: dashboard.tags,
      isStarred: dashboard.isStarred,
    }));

    return NextResponse.json({
      dashboards: simplifiedDashboards,
      count: simplifiedDashboards.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to connect to Grafana service',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
