import GrafanaDashboard from '../components/GrafanaDashboard';
import { BarChart3 } from 'lucide-react';

export default function MonitoringPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <BarChart3 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Monitoring Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time CRM metrics and performance visualization
          </p>
        </div>
      </div>

      {/* Dashboard */}
      <GrafanaDashboard dashboardUid="ffa71stvsyt4wd" />
    </div>
  );
}
