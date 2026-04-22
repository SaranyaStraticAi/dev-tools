import { readFileSync } from 'fs';
import { join } from 'path';

export default function ChatAnalyticsPage() {
  const key  = process.env.CHAT_DASHBOARD_KEY ?? '';
  const uKey = process.env.CHAT_USER_ANALYSIS_KEY ?? '';

  let html = readFileSync(join(process.cwd(), 'public', 'chat-analytics.html'), 'utf-8');

  // Inject keys server-side — keys never sent to browser in source
  html = html.replace("const CODE     = '';", `const CODE     = '${key}';`);
  html = html.replace("const U_CODE = '';",   `const U_CODE = '${uKey}';`);

  // Restore direct Azure URLs
  html = html.replace(
    "const BASE_URL = '/api/chat-proxy';",
    "const BASE_URL = 'https://func-vibetrader-prod.azurewebsites.net/api/chatanalyticsdashboard';"
  );
  html = html.replace(
    "const U_URL  = '/api/chat-user-proxy';",
    "const U_URL  = 'https://func-vibetrader-prod.azurewebsites.net/api/chatuseranalysis';"
  );

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] -m-4">
      <iframe
        srcDoc={html}
        className="flex-1 w-full border-0"
        title="Chat Analytics Dashboard"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  );
}
