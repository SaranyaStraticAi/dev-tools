
'use server';

import { createClerkClient } from '@clerk/backend';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

// Patch shape applied to Clerk publicMetadata to mirror the Postgres write.
// `null` values delete the key, matching Clerk's metadata merge semantics.
type ClerkPlanPatch = {
  planName?: string | null;
  subscriptionStatus?: string | null;
  subscribed?: boolean;
  hasPaidForBroker?: boolean;
};

function clerkPatchForCommand(command: string): ClerkPlanPatch | null {
  switch (command) {
    case 'trial-new':
    case 'trial-ending':
    case 'trial-expired':
      return { planName: null, subscriptionStatus: null, subscribed: false, hasPaidForBroker: false };
    case 'subscribed':
      return { planName: 'Pro Monthly', subscriptionStatus: 'active', subscribed: true, hasPaidForBroker: false };
    case 'subscribed-yearly':
      return { planName: 'Pro Yearly', subscriptionStatus: 'active', subscribed: true, hasPaidForBroker: false };
    case 'canceled':
      return { planName: 'Pro Plan', subscriptionStatus: 'canceled', subscribed: false, hasPaidForBroker: false };
    case 'broker-paid':
      return { planName: null, subscriptionStatus: null, subscribed: false, hasPaidForBroker: true };
    case 'reset':
      return { planName: null, subscriptionStatus: null, subscribed: false, hasPaidForBroker: false };
    default:
      return null;
  }
}

// Try Live first, fall back to Dev. Returns the instance label on success, null if user not found.
async function syncClerkMetadata(
  clerkUserId: string,
  patch: ClerkPlanPatch,
): Promise<{ instance: 'Live' | 'Dev' } | { error: string }> {
  const candidates: Array<{ key: string | undefined; label: 'Live' | 'Dev' }> = [
    { key: process.env.CLERK_LIVE_SECRET_KEY, label: 'Live' },
    { key: process.env.CLERK_SECRET_KEY, label: 'Dev' },
  ];

  let lastError: string | null = null;
  for (const { key, label } of candidates) {
    if (!key) continue;
    try {
      const clerk = createClerkClient({ secretKey: key });
      // Confirm user exists in this instance before patching — avoids a noisy 404.
      await clerk.users.getUser(clerkUserId);
      await clerk.users.updateUserMetadata(clerkUserId, { publicMetadata: patch });
      return { instance: label };
    } catch (e) {
      const err = e as { status?: number; statusCode?: number; message?: string };
      const status = err.status ?? err.statusCode;
      if (status === 404) continue; // try next instance
      lastError = err.message ?? `Clerk ${label} update failed`;
    }
  }
  return { error: lastError ?? 'User not found in any Clerk instance' };
}

export async function updateUserStatus(email: string, command: string) {
  if (!email) return { error: 'Email is required' };

  try {
    const now = new Date();

    switch (command) {
      case 'trial-new':
        await prisma.users.update({
          where: { email },
          data: {
            created_at: now,
            subscription_status: null,
            plan_name: null,
            has_paid_for_broker: false,
          },
        });
        break;

      case 'trial-ending':
        const elevenDaysAgo = new Date();
        elevenDaysAgo.setDate(elevenDaysAgo.getDate() - 11);
        await prisma.users.update({
          where: { email },
          data: {
            created_at: elevenDaysAgo,
            subscription_status: null,
            plan_name: null,
            has_paid_for_broker: false,
          },
        });
        break;

      case 'trial-expired':
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
        await prisma.users.update({
          where: { email },
          data: {
            created_at: fifteenDaysAgo,
            subscription_status: null,
            plan_name: null,
            has_paid_for_broker: false,
          },
        });
        break;

      case 'subscribed':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        await prisma.users.update({
          where: { email },
          data: {
            created_at: thirtyDaysAgo,
            subscription_status: 'active',
            plan_name: 'Pro Monthly',
            stripe_customer_id: 'cus_test_' + Date.now(),
            stripe_subscription_id: 'sub_test_' + Date.now(),
            stripe_product_id: 'prod_monthly_' + Date.now(),
            has_paid_for_broker: false,
          },
        });
        break;

      case 'subscribed-yearly':
        const thirtyDaysAgoYearly = new Date();
        thirtyDaysAgoYearly.setDate(thirtyDaysAgoYearly.getDate() - 30);
        await prisma.users.update({
            where: { email },
            data: {
              created_at: thirtyDaysAgoYearly,
              subscription_status: 'active',
              plan_name: 'Pro Yearly',
              stripe_customer_id: 'cus_test_' + Date.now(),
              stripe_subscription_id: 'sub_test_' + Date.now(),
              stripe_product_id: 'prod_yearly_' + Date.now(),
              has_paid_for_broker: false,
            },
          });
        break;

      case 'canceled':
        const thirtyDaysAgoCanceled = new Date();
        thirtyDaysAgoCanceled.setDate(thirtyDaysAgoCanceled.getDate() - 30);
        await prisma.users.update({
          where: { email },
          data: {
            created_at: thirtyDaysAgoCanceled,
            subscription_status: 'canceled',
            plan_name: 'Pro Plan',
            has_paid_for_broker: false,
          },
        });
        break;

      case 'broker-paid':
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        await prisma.users.update({
          where: { email },
          data: {
            created_at: fiveDaysAgo,
            subscription_status: null,
            plan_name: null,
            has_paid_for_broker: true,
          },
        });
        break;

      case 'reset':
        await prisma.users.update({
          where: { email },
          data: {
            created_at: now,
            subscription_status: null,
            plan_name: null,
            stripe_customer_id: null,
            stripe_subscription_id: null,
            stripe_product_id: null,
            has_paid_for_broker: false,
          },
        });
        break;

      default:
        return { error: 'Invalid command' };
    }

    // Mirror the change into Clerk publicMetadata so the source-of-truth stays in sync.
    const patch = clerkPatchForCommand(command);
    let clerkResult: Awaited<ReturnType<typeof syncClerkMetadata>> | null = null;
    if (patch) {
      const dbUser = await prisma.users.findUnique({
        where: { email },
        select: { clerk_user_id: true },
      });
      if (dbUser?.clerk_user_id) {
        clerkResult = await syncClerkMetadata(dbUser.clerk_user_id, patch);
        if ('error' in clerkResult) {
          console.error(`Clerk sync failed for ${email}:`, clerkResult.error);
        }
      } else {
        clerkResult = { error: 'No clerk_user_id on Postgres row — Clerk not synced' };
        console.warn(clerkResult.error, email);
      }
    }

    revalidatePath('/users');
    revalidatePath('/user-directory');

    if (clerkResult && 'error' in clerkResult) {
      return { success: true, warning: `Postgres updated. ${clerkResult.error}` };
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to update user status:', error);
    return { error: 'Database update failed' };
  }
}
