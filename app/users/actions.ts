
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

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

    revalidatePath('/users');
    return { success: true };
  } catch (error) {
    console.error('Failed to update user status:', error);
    return { error: 'Database update failed' };
  }
}
