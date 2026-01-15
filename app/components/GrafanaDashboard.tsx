'use client';

import { useState } from 'react';
import { ExternalLink, BarChart3, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GrafanaDashboardProps {
  dashboardUid?: string;
  panelId?: number;
}

export default function GrafanaDashboard({
  dashboardUid = 'ffa71stvsyt4wd',
  panelId = 1,
}: GrafanaDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL;

  // Build the dashboard embed URL
  const buildEmbedUrl = () => {
    if (!grafanaUrl) return null;

    const now = Date.now();
    const from = now - 3600000; // 1 hour ago
    const to = now;

    const params = new URLSearchParams({
      orgId: '1',
      from: from.toString(),
      to: to.toString(),
      timezone: 'browser',
      kiosk: 'tv', // 'tv' mode removes navbar and sidebar
    });

    // Use local proxy path instead of direct URL
    // Using /d/ instead of /d-solo/ to show the full dashboard
    // We can use /d/ directly now since the middleware proxies it
    return `/d/${dashboardUid}/crm-monitoring-dashboard?${params.toString()}`;
  };

  // Build full dashboard URL for "Open in new tab"
  const buildDashboardUrl = () => {
    if (!grafanaUrl) return null;
    return `${grafanaUrl}/d/${dashboardUid}?orgId=1&refresh=30s`;
  };

  const embedUrl = buildEmbedUrl();
  const dashboardUrl = buildDashboardUrl();

  const handleRefresh = () => {
    setIsLoading(true);
    setLastRefresh(new Date());
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const openInNewTab = () => {
    if (dashboardUrl) {
      window.open(dashboardUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (!grafanaUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-muted rounded-lg">
        <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Configuration Required</h3>
        <p className="text-muted-foreground text-center max-w-md">
          Grafana URL is not configured. Please set NEXT_PUBLIC_GRAFANA_URL.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative bg-background rounded-lg border ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BarChart3 className="w-4 h-4" />
          <span>CRM Monitoring Dashboard</span>
          <span className="text-xs">• Updated: {lastRefresh.toLocaleTimeString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={openInNewTab}
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 top-10 flex items-center justify-center bg-background/80 z-10">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading dashboard...</span>
          </div>
        </div>
      )}

      {/* Grafana iframe - using solo panel embed format */}
      <iframe
        key={lastRefresh.getTime()}
        src={embedUrl || ''}
        className={`w-full border-0 ${isFullscreen ? 'h-[calc(100vh-2.5rem)]' : 'h-[600px]'}`}
        onLoad={handleIframeLoad}
        title="Grafana Dashboard"
        frameBorder="0"
      />
    </div>
  );
}
