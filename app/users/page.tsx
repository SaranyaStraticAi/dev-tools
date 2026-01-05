
import { prisma } from '@/lib/prisma';
import { columns } from './columns';
import { DataTable } from './data-table';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const allUsers = await prisma.users.findMany({
    orderBy: {
      created_at: 'desc',
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Users
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            View all users and their subscription status from the database.
          </p>
        </header>

        <DataTable columns={columns} data={allUsers} />
      </div>
    </div>
  );
}
