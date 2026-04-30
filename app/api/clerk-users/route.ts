import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';

interface ClerkUserSummary {
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    instance: 'Live' | 'Dev';
}

const INSTANCES: Array<{ name: 'Live' | 'Dev'; secretKey: string | undefined }> = [
    { name: 'Live', secretKey: process.env.CLERK_LIVE_SECRET_KEY },
    { name: 'Dev', secretKey: process.env.CLERK_SECRET_KEY },
];

// Clerk's getUserList accepts up to 100 IDs per call.
const CLERK_BATCH = 100;

/**
 * POST /api/clerk-users
 * Body: { userIds: string[] }
 * Returns: { users: Record<userId, { email, firstName, lastName, instance }> }
 *
 * Uses Clerk's bulk getUserList({ userId: [...] }) — one round trip per
 * instance per batch of 100 IDs, instead of one call per user.
 */
export async function POST(request: NextRequest) {
    let userIds: string[] = [];
    try {
        const body = await request.json();
        userIds = Array.isArray(body?.userIds) ? body.userIds.filter((s: unknown): s is string => typeof s === 'string' && s.length > 0) : [];
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (userIds.length === 0) {
        return NextResponse.json({ users: {} });
    }

    const dedup = Array.from(new Set(userIds));
    const result: Record<string, ClerkUserSummary> = {};

    // Live first so duplicate IDs across instances are won by Live (matches existing convention).
    for (const instance of INSTANCES) {
        if (!instance.secretKey) continue;
        const remaining = dedup.filter(id => !result[id]);
        if (remaining.length === 0) break;

        const client = createClerkClient({ secretKey: instance.secretKey });

        // Chunk to respect Clerk's 100-id limit.
        for (let i = 0; i < remaining.length; i += CLERK_BATCH) {
            const chunk = remaining.slice(i, i + CLERK_BATCH);
            try {
                const list = await client.users.getUserList({ userId: chunk, limit: chunk.length });
                for (const u of list.data) {
                    const primaryEmail = u.emailAddresses?.find(e => e.id === u.primaryEmailAddressId);
                    result[u.id] = {
                        email: primaryEmail?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress ?? null,
                        firstName: u.firstName ?? null,
                        lastName: u.lastName ?? null,
                        instance: instance.name,
                    };
                }
            } catch (e) {
                console.error(`[clerk-users] ${instance.name} batch failed:`, (e as Error).message);
            }
        }
    }

    return NextResponse.json({ users: result });
}
