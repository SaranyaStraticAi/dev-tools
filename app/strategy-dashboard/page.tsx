import { readFileSync } from 'fs';
import { join } from 'path';

export default function StrategyDashboardPage() {
  const key  = process.env.STRATEGY_DASHBOARD_KEY ?? '';
  const uKey = process.env.STRATEGY_USER_ANALYSIS_KEY ?? '';

  let html = readFileSync(
    join(process.cwd(), 'public', 'strategy-dashboard.html'),
    'utf-8',
  );

  // Inject keys server-side — never exposed in browser source
  html = html.replace("const CODE = '';",   `const CODE = '${key}';`);
  html = html.replace("const U_CODE = '';", `const U_CODE = '${uKey}';`);

  // Restore direct Azure Function URLs
  html = html.replace(
    "const BASE_URL = '/api/strategy-proxy';",
    "const BASE_URL = 'https://func-vibetrader-prod.azurewebsites.net/api/strategyanalyticsdashboard';",
  );
  html = html.replace(
    "const U_URL = '/api/strategy-user-proxy';",
    "const U_URL = 'https://func-vibetrader-prod.azurewebsites.net/api/strategyuseranalysis';",
  );

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] -m-4">
      <iframe
        srcDoc={html}
        className="flex-1 w-full border-0"
        title="Strategy Analytics Dashboard"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  );
}
