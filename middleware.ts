import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const isExplicitProxy = pathname.startsWith('/grafana-proxy');
  const isGrafanaAsset = pathname.startsWith('/public') || pathname.startsWith('/avatar');
  const isGrafanaDashboard = pathname.startsWith('/d/');

  const isLocalApi =
    pathname.startsWith('/api/assets') ||
    pathname.startsWith('/api/clerk-search') ||
    pathname.startsWith('/api/clerk-users') ||
    pathname.startsWith('/api/delete') ||
    pathname.startsWith('/api/grafana') ||
    pathname.startsWith('/api/query') ||
    pathname.startsWith('/api/metaapi-lookup') ||
    pathname.startsWith('/api/metaapi-connections') ||
    pathname.startsWith('/api/metaapi-manage') ||
    pathname.startsWith('/api/metaapi-health') ||
    pathname.startsWith('/api/user-directory') ||
    pathname.startsWith('/api/user-reports') ||
    pathname.startsWith('/api/generate-image') ||
    pathname.startsWith('/api/generate-banner') ||
    pathname.startsWith('/api/generate-video') ||
    pathname.startsWith('/api/prompt') ||
    pathname.startsWith('/api/prompt-config') ||
    pathname.startsWith('/api/newsletter-generate') ||
    pathname.startsWith('/api/newsletter-prompts') ||
    pathname.startsWith('/api/reddit-posts') ||
    pathname.startsWith('/api/resend-contacts') ||
    pathname.startsWith('/api/resend-segments') ||
    pathname.startsWith('/api/send-newsletter') ||
    pathname.startsWith('/api/newsletter-metrics') ||
    pathname.startsWith('/api/newsletter-pipeline') ||
    pathname.startsWith('/api/marketing-links') ||
    pathname.startsWith('/api/link-tracker') ||
    pathname.startsWith('/api/news-source') ||
    pathname.startsWith('/api/commissions') ||
    pathname.startsWith('/api/email-campaigns') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/newsrag') ||
    pathname.startsWith('/api/edu-content');   // ← edu content tester

  const isGrafanaApi = pathname.startsWith('/api/') && !isLocalApi;

  if (isExplicitProxy || isGrafanaAsset || isGrafanaApi || isGrafanaDashboard) {
    const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL;
    const apiToken = process.env.GRAFANA_API_TOKEN;

    console.log('Grafana Proxy Request:', pathname);

    if (!grafanaUrl || !apiToken) {
      console.error('Grafana configuration missing');
      return new NextResponse('Grafana configuration missing', { status: 500 });
    }

    let targetPath = pathname;
    if (isExplicitProxy) {
      targetPath = pathname.replace('/grafana-proxy', '');
    }

    const url = new URL(`${grafanaUrl}${targetPath}`);
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('Authorization', `Bearer ${apiToken}`);
    requestHeaders.set('Host', url.host);
    requestHeaders.set('Origin', url.origin);

    return NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
  }
}

export const config = {
  matcher: [
    '/grafana-proxy/:path*',
    '/public/:path*',
    '/avatar/:path*',
    '/api/:path*',
    '/d/:path*',
  ],
};
