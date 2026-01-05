'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, ArrowUpDown } from 'lucide-react';
import { updateUserStatus } from './actions';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SubscriptionStatusDialog } from './SubscriptionDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

// Define the User type matching our Prisma model subset we use
export type User = {
  id: number;
  clerk_user_id: string;
  name: string | null;
  email: string;
  role: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_product_id: string | null;
  plan_name: string | null;
  subscription_status: string | null;
  has_paid_for_broker: boolean | null;
  referral_id: string | null;
};

// Helper for initials
function getInitials(name: string | null, email: string) {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}



export const columns: ColumnDef<User>[] = [

  {
    id: 'manage',
    header: '',
    cell: ({ row }) => {
        return (
            <SubscriptionStatusDialog 
                email={row.original.email} 
                currentStatus={row.original.subscription_status}
                currentPlan={row.original.plan_name}
            />
        )
    }
  },
  {
    id: 'name',
    accessorFn: (row) => `${row.name || ''} ${row.email}`,
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          User
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
             {/* We don't have user images yet, so just fallback */}
            <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 font-medium text-xs">
              {getInitials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
              {user.name || 'Anonymous'}
            </span>
            <span className="text-xs text-gray-500">{user.email}</span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'plan_name',
    header: 'Plan',
    cell: ({ row }) => {
      const plan = row.getValue('plan_name') as string | null;
      return (
        <span className="font-medium text-sm capitalize">
          {plan || <span className="text-gray-400 italic">Free</span>}
        </span>
      );
    },
  },
  {
    accessorKey: 'subscription_status',
    header: 'Sub Status',
    cell: ({ row }) => {
        const status = row.getValue('subscription_status') as string | null;
        if (!status) return <span className="text-gray-400">-</span>;
        return (
             <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-5 capitalize">
                {status}
            </Badge>
        )
    }
  },
  {
    accessorKey: 'has_paid_for_broker',
    header: 'Broker Paid',
    cell: ({ row }) => {
        const hasPaid = row.getValue('has_paid_for_broker') as boolean;
        if (!hasPaid) return <span className="text-gray-400">-</span>;
        return (
            <Badge variant="secondary" className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                Yes
            </Badge>
        );
    }
  },

  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => (
        <span className="capitalize text-sm text-gray-700 dark:text-gray-300">
            {row.getValue('role')}
        </span>
    ),
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Joined
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <span className="text-sm text-gray-500">
          {new Date(row.getValue('created_at')).toLocaleDateString()}
        </span>
      );
    },
  },
  {
    accessorKey: 'clerk_user_id',
    header: 'Clerk ID',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-gray-500 truncate max-w-[150px] inline-block" title={row.getValue('clerk_user_id')}>
        {row.getValue('clerk_user_id')}
      </span>
    ),
  },
  {
    accessorKey: 'stripe_customer_id',
    header: 'Stripe Customer',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-gray-500 truncate max-w-[150px] inline-block">
        {row.getValue('stripe_customer_id') || '-'}
      </span>
    ),
  },
  {
    accessorKey: 'stripe_subscription_id',
    header: 'Stripe Sub ID',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-gray-500 truncate max-w-[150px] inline-block">
        {row.getValue('stripe_subscription_id') || '-'}
      </span>
    ),
  },
  {
    accessorKey: 'referral_id',
    header: 'Referral ID',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-gray-500">
        {row.getValue('referral_id') || '-'}
      </span>
    ),
  },
  {
    accessorKey: 'updated_at',
    header: 'Last Updated',
    cell: ({ row }) => (
      <span className="text-sm text-gray-500">
        {new Date(row.getValue('updated_at')).toLocaleDateString()}
      </span>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const user = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(user.email)}
            >
              Copy Email
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600">Delete User</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
