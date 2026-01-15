import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Define paths that should be proxied to Grafana
  // /grafana-proxy -> explicitly proxied dashboard requests (strip prefix)
  // /public, /avatar -> Grafana static assets (keep path)
  // /api/live, /api/dashboards, /api/datasources -> Common Grafana APIs (keep path)
  // Note: We need to be careful not to intercept local Next.js API routes that might start with /api
  // The matcher below limits the scope.

  const isExplicitProxy = pathname.startsWith('/grafana-proxy');
  const isGrafanaAsset = pathname.startsWith('/public') || pathname.startsWith('/avatar');
  const isGrafanaDashboard = pathname.startsWith('/d/');
  // Proxy ALL /api requests to Grafana, EXCEPT for our local Next.js API routes
  // This ensures we catch all Grafana APIs (alerts, rules, datasources, etc.) automatically
  const isLocalApi = pathname.startsWith('/api/clerk-search') ||
                     pathname.startsWith('/api/delete') ||
                     pathname.startsWith('/api/grafana') ||
                     pathname.startsWith('/api/query') ||
                     pathname.startsWith('/api/auth'); // Standard next-auth path just in case

  const isGrafanaApi = pathname.startsWith('/api/') && !isLocalApi;

  if (isExplicitProxy || isGrafanaAsset || isGrafanaApi || isGrafanaDashboard) {
    const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL;
    const apiToken = process.env.GRAFANA_API_TOKEN;

    console.log('Grafana Proxy Request:', pathname);

    if (!grafanaUrl || !apiToken) {
      console.error('Grafana configuration missing');
      return new NextResponse('Grafana configuration missing', { status: 500 });
    }

    // Determine target URL
    let targetPath = pathname;
    if (isExplicitProxy) {
      targetPath = pathname.replace('/grafana-proxy', '');
    }
    
    // Construct target URL
    const url = new URL(`${grafanaUrl}${targetPath}`);
    
    // Copy search params
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    // Create a new request headers object
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('Authorization', `Bearer ${apiToken}`);
    
    // update Host and Origin headers to match the target Grafana instance
    // This resolves issues where Grafana rejects usage based on Host/Origin mismatch
    requestHeaders.set('Host', url.host);
    requestHeaders.set('Origin', url.origin);

    // Rewrite to the new URL with updated headers
    return NextResponse.rewrite(url, {
      request: {
        headers: requestHeaders,
      },
    });
  }
}

export const config = {
  // Minimize the matcher to only what we need to proxy to avoid performance impact
  matcher: [
    '/grafana-proxy/:path*',
    '/public/:path*',
    '/avatar/:path*',
    '/api/:path*',
    '/d/:path*',
  ],
};
