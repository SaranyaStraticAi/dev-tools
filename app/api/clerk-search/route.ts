import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { TableClient } from '@azure/data-tables';

interface ClerkInstance {
  publishableKey: string;
  secretKey: string;
  name?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { instances, userId: identifier } = await request.json();

    if (!instances || !Array.isArray(instances) || instances.length === 0) {
      return NextResponse.json(
        { error: 'At least one Clerk instance is required' },
        { status: 400 }
      );
    }

    if (!identifier || typeof identifier !== 'string' || identifier.trim() === '') {
      return NextResponse.json(
        { error: 'User ID or Email is required' },
        { status: 400 }
      );
    }

    const isEmail = identifier.includes('@');

    // Search across all instances
    for (const instance of instances as ClerkInstance[]) {
      let secretKey = instance.secretKey;

      // Handle default instances by looking up secrets from env variables
      // to keep them secure and avoid sending them back and forth from the client
      if ((instance as any).id === 'default-1') {
        secretKey = process.env.CLERK_SECRET_KEY || '';
      } else if ((instance as any).id === 'default-2') {
        secretKey = process.env.CLERK_LIVE_SECRET_KEY || '';
      }

      if (!secretKey) {
        continue; // Skip invalid instances
      }

      try {
        const clerkClient = createClerkClient({
          secretKey: secretKey,
        });

        let user: any = null;

        if (isEmail) {
          // Search by email
          const userList = await clerkClient.users.getUserList({
            emailAddress: [identifier.trim()],
            limit: 1,
          });
          if (userList.data.length > 0) {
            user = userList.data[0];
          }
        } else {
          // Try to get the user by ID
          try {
            user = await clerkClient.users.getUser(identifier.trim());
          } catch (e: any) {
            // If it's a 404, we'll just keep user as null
            if (e.status !== 404 && e.statusCode !== 404) {
              throw e;
            }
          }
        }

        if (user) {
          // User found! Return all available details
          return NextResponse.json({
            success: true,
            user: {
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
              primaryWeb3WalletId: user.primaryWeb3WalletId,
              passwordEnabled: user.passwordEnabled,
              twoFactorEnabled: user.twoFactorEnabled,
              totpEnabled: user.totpEnabled,
              backupCodeEnabled: user.backupCodeEnabled,
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
              samlAccounts: user.samlAccounts || [],
              web3Wallets: user.web3Wallets || [],
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
              lastSignInAt: user.lastSignInAt,
              banned: user.banned,
              locked: user.locked,
              lockoutExpiresInSeconds: (user as any).lockoutExpiresInSeconds ?? null,
              verificationAttemptsRemaining: (user as any).verificationAttemptsRemaining ?? null,
              deleteSelfEnabled: user.deleteSelfEnabled,
              createOrganizationEnabled: user.createOrganizationEnabled,
              lastActiveAt: user.lastActiveAt,
              metaApiConnection: await (async () => {
                const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
                if (!connectionString) return null;

                try {
                  const tableClient = TableClient.fromConnectionString(connectionString, 'UserBrokerConnections');
                  const entity: any = await tableClient.getEntity(user.id, 'metaapi');

                  if (entity) {
                    let parsedMetadata = {};
                    if (entity.metadata) {
                      try {
                        parsedMetadata = typeof entity.metadata === 'string'
                          ? JSON.parse(entity.metadata)
                          : entity.metadata;
                      } catch { }
                    }

                    return {
                      accountId: entity.accountId,
                      connected: entity.connected,
                      lastUpdated: entity.lastUpdated,
                      brokerName: (parsedMetadata as any).brokerName || null,
                      server: (parsedMetadata as any).server || null,
                      platform: (parsedMetadata as any).platform || null,
                      region: (parsedMetadata as any).region || null,
                      metadata: parsedMetadata,
                    };
                  }
                } catch (e: any) {
                  // If 404, user just doesn't have a MetaAPI connection
                  if (e.statusCode !== 404) {
                    console.error('Error fetching MetaAPI connection for user:', e.message);
                  }
                }
                return null;
              })(),
            },
            foundInInstance: instance.name || instance.publishableKey,
            instanceIndex: instances.indexOf(instance),
          });
        }
      } catch (error: any) {
        // If user not found (404), continue to next instance
        // If it's a different error, log it but continue searching
        if (error?.status !== 404 && error?.statusCode !== 404) {
          console.error(`Error searching in instance ${instance.name || instance.publishableKey}:`, error.message);
        }
        // Continue to next instance
        continue;
      }
    }

    // User not found in any instance
    return NextResponse.json({
      success: false,
      message: `No user with ${isEmail ? 'email' : 'ID'} "${identifier}" found in any Clerk instance`,
      searchedInstances: instances.length,
    });
  } catch (error: any) {
    console.error('Clerk search error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to search for user',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}

