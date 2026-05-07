
import { createClerkClient } from '@clerk/backend';
import { prisma } from '@/lib/prisma';
import { columns } from './columns';
import { DataTable } from './data-table';

export const dynamic = 'force-dynamic';

type ClerkMetaInfo = {
  plan: string | null;
  subscribed: boolean | null;
  subscriptionStatus: string | null;
  onboarded: boolean | null;
  onboardedAt: string | null;
};

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v : null;
const bool = (v: unknown): boolean | null =>
  typeof v === 'boolean' ? v : null;

async function getClerkMetaMap(secretKey: string | undefined): Promise<Map<string, ClerkMetaInfo>> {
  const map = new Map<string, ClerkMetaInfo>();
  if (!secretKey) return map;
  try {
    const clerk = createClerkClient({ secretKey });
    let offset = 0;
    const limit = 500;
    const first = await clerk.users.getUserList({ limit, offset });
    type ClerkUserLite = { id: string; publicMetadata?: Record<string, unknown> | null };
    const collect = (users: ClerkUserLite[]) => {
      for (const u of users) {
        const meta = u.publicMetadata && typeof u.publicMetadata === 'object' ? u.publicMetadata : null;
        if (!meta || Object.keys(meta).length === 0) continue;
        map.set(u.id, {
          plan: str(meta.planName),
          subscribed: bool(meta.subscribed),
          subscriptionStatus: str(meta.subscriptionStatus),
          onboarded: bool(meta.onboarded),
          onboardedAt: str(meta.onboardedAt),
        });
      }
    };
    collect(first.data);
    offset += limit;
    while (offset < first.totalCount) {
      const page = await clerk.users.getUserList({ limit, offset });
      collect(page.data);
      offset += limit;
    }
  } catch (e) {
    console.error('Failed to fetch Clerk metadata:', e);
  }
  return map;
}

export default async function UsersPage() {
  const [allUsers, liveMetaMap, devMetaMap] = await Promise.all([
    prisma.users.findMany({
      orderBy: { created_at: 'desc' },
    }),
    getClerkMetaMap(process.env.CLERK_LIVE_SECRET_KEY),
    getClerkMetaMap(process.env.CLERK_SECRET_KEY),
  ]);

  // Live takes priority for duplicate clerk IDs (matches /api/user-directory behavior)
  const usersWithClerkPlan = allUsers.map(u => {
    const info = liveMetaMap.get(u.clerk_user_id) ?? devMetaMap.get(u.clerk_user_id) ?? null;
    return {
      ...u,
      clerk_plan: info?.plan ?? null,
      clerk_subscribed: info?.subscribed ?? null,
      clerk_subscription_status: info?.subscriptionStatus ?? null,
      clerk_onboarded: info?.onboarded ?? null,
      clerk_onboarded_at: info?.onboardedAt ?? null,
    };
  });

  return (
    <div className="min-h-screen w-full bg-gray-50 dark:bg-gray-900">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Users
          </h1>
          <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
            View all users and their subscription status. Plan (Clerk) is the source of truth from publicMetadata; Plan (DB) is the Postgres fallback.
          </p>
        </header>

        <DataTable columns={columns} data={usersWithClerkPlan} />
      </div>
    </div>
  );
}
