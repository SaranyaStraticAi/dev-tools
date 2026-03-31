import { NextRequest, NextResponse } from 'next/server';
import { TableClient } from '@azure/data-tables';
import { createClerkClient } from '@clerk/backend';

interface BrokerConnectionEntity {
    partitionKey: string; // userId
    rowKey: string; // brokerType
    connected?: boolean;
    lastUpdated?: string;
    accountId?: string;
    metadata?: string;
}

interface ClerkInstance {
    id: string;
    name: string;
    secretKey: string;
}

/**
 * POST /api/metaapi-lookup
 * Given a MetaAPI account ID, find the user who owns it by scanning
 * Azure Table Storage, then fetch their Clerk profile.
 */
export async function POST(request: NextRequest) {
    try {
        const { metaApiAccountId } = await request.json();

        if (!metaApiAccountId || typeof metaApiAccountId !== 'string' || metaApiAccountId.trim() === '') {
            return NextResponse.json(
                { error: 'MetaAPI Account ID is required' },
                { status: 400 }
            );
        }

        const accountIdToFind = metaApiAccountId.trim();

        // ── 1. Connect to Azure Table Storage ──────────────────────────
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (!connectionString) {
            return NextResponse.json(
                { error: 'AZURE_STORAGE_CONNECTION_STRING not configured in .env.local' },
                { status: 500 }
            );
        }

        const tableName = 'UserBrokerConnections';
        const tableClient = TableClient.fromConnectionString(connectionString, tableName);

        // ── 2. Scan for matching accountId ─────────────────────────────
        // Filter by RowKey = 'metaapi' to only scan MetaAPI connections
        const entities = tableClient.listEntities<BrokerConnectionEntity>({
            queryOptions: {
                filter: `RowKey eq 'metaapi'`,
            },
        });

        let matchedEntity: BrokerConnectionEntity | null = null;

        for await (const entity of entities) {
            // Check accountId field directly
            if (entity.accountId === accountIdToFind) {
                matchedEntity = entity;
                break;
            }

            // Also check inside metadata JSON
            if (entity.metadata) {
                try {
                    const metadata = typeof entity.metadata === 'string'
                        ? JSON.parse(entity.metadata)
                        : entity.metadata;
                    if (metadata.accountId === accountIdToFind) {
                        matchedEntity = entity;
                        break;
                    }
                } catch {
                    // Skip malformed metadata
                }
            }
        }

        if (!matchedEntity) {
            return NextResponse.json({
                success: false,
                message: `No user found with MetaAPI account ID "${accountIdToFind}"`,
            });
        }

        // ── 3. Extract connection info ─────────────────────────────────
        const userId = matchedEntity.partitionKey;
        let parsedMetadata: Record<string, unknown> = {};
        if (matchedEntity.metadata) {
            try {
                parsedMetadata = typeof matchedEntity.metadata === 'string'
                    ? JSON.parse(matchedEntity.metadata)
                    : matchedEntity.metadata;
            } catch {
                // ignore
            }
        }

        const connectionInfo = {
            userId,
            accountId: matchedEntity.accountId || accountIdToFind,
            connected: matchedEntity.connected ?? false,
            lastUpdated: matchedEntity.lastUpdated || null,
            brokerName: (parsedMetadata.brokerName as string) || null,
            server: (parsedMetadata.server as string) || null,
            platform: (parsedMetadata.platform as string) || null,
            region: (parsedMetadata.region as string) || null,
            metadata: parsedMetadata,
        };

        // ── 4. Fetch user details from Clerk ───────────────────────────
        // Try both dev and live instances (same pattern as clerk-search)
        const instances: ClerkInstance[] = [
            {
                id: 'default-1',
                name: 'Dev Account',
                secretKey: process.env.CLERK_SECRET_KEY || '',
            },
            {
                id: 'default-2',
                name: 'Live Account (VibeTrader)',
                secretKey: process.env.CLERK_LIVE_SECRET_KEY || '',
            },
        ];

        let userDetails: Record<string, unknown> | null = null;
        let foundInInstance: string | null = null;

        for (const instance of instances) {
            if (!instance.secretKey) continue;

            try {
                const clerkClient = createClerkClient({ secretKey: instance.secretKey });
                const user = await clerkClient.users.getUser(userId);

                if (user) {
                    userDetails = {
                        id: user.id,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        username: user.username,
                        emailAddresses: user.emailAddresses?.map((email: any) => ({
                            id: email.id,
                            emailAddress: email.emailAddress,
                            verification: email.verification,
                        })) || [],
                        phoneNumbers: user.phoneNumbers?.map((phone: any) => ({
                            id: phone.id,
                            phoneNumber: phone.phoneNumber,
                            verification: phone.verification,
                        })) || [],
                        imageUrl: user.imageUrl,
                        hasImage: user.hasImage,
                        primaryEmailAddressId: user.primaryEmailAddressId,
                        primaryPhoneNumberId: user.primaryPhoneNumberId,
                        passwordEnabled: user.passwordEnabled,
                        twoFactorEnabled: user.twoFactorEnabled,
                        publicMetadata: user.publicMetadata,
                        privateMetadata: user.privateMetadata,
                        unsafeMetadata: user.unsafeMetadata,
                        externalAccounts: user.externalAccounts?.map((account: any) => ({
                            id: account.id,
                            provider: account.provider,
                            providerUserId: account.providerUserId,
                            emailAddress: account.emailAddress,
                            username: account.username,
                            firstName: account.firstName,
                            lastName: account.lastName,
                            imageUrl: account.imageUrl,
                        })) || [],
                        createdAt: user.createdAt,
                        updatedAt: user.updatedAt,
                        lastSignInAt: user.lastSignInAt,
                        lastActiveAt: user.lastActiveAt,
                        banned: user.banned,
                        locked: user.locked,
                    };
                    foundInInstance = instance.name;
                    break;
                }
            } catch (error: any) {
                // User not found (404) in this instance, try next
                if (error?.status !== 404 && error?.statusCode !== 404) {
                    console.error(`Error fetching user from ${instance.name}:`, error.message);
                }
                continue;
            }
        }

        return NextResponse.json({
            success: true,
            connectionInfo,
            user: userDetails,
            foundInInstance,
        });
    } catch (error: any) {
        console.error('MetaAPI lookup error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Failed to lookup MetaAPI account',
                details: error.toString(),
            },
            { status: 500 }
        );
    }
}
