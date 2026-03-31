'use client';

import { useState } from 'react';

interface ConnectionInfo {
    userId: string;
    accountId: string;
    connected: boolean;
    lastUpdated: string | null;
    brokerName: string | null;
    server: string | null;
    platform: string | null;
    region: string | null;
    metadata: Record<string, unknown>;
}

interface UserDetails {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    emailAddresses: Array<{
        id: string;
        emailAddress: string;
        verification: any;
    }>;
    phoneNumbers: Array<{
        id: string;
        phoneNumber: string;
        verification: any;
    }>;
    imageUrl: string;
    hasImage: boolean;
    primaryEmailAddressId: string | null;
    primaryPhoneNumberId: string | null;
    passwordEnabled: boolean;
    twoFactorEnabled: boolean;
    publicMetadata: any;
    privateMetadata: any;
    unsafeMetadata: any;
    externalAccounts: Array<{
        id: string;
        provider: string;
        providerUserId: string;
        emailAddress: string | null;
        username: string | null;
        firstName: string | null;
        lastName: string | null;
        imageUrl: string | null;
    }>;
    createdAt: number;
    updatedAt: number;
    lastSignInAt: number | null;
    lastActiveAt: number | null;
    banned: boolean;
    locked: boolean;
}

export default function MetaApiLookupPage() {
    const [accountId, setAccountId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null);
    const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
    const [foundInInstance, setFoundInInstance] = useState<string | null>(null);
    const [notFoundMessage, setNotFoundMessage] = useState<string | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!accountId.trim()) {
            setError('Please enter a MetaAPI Account ID');
            return;
        }

        setLoading(true);
        setError(null);
        setConnectionInfo(null);
        setUserDetails(null);
        setFoundInInstance(null);
        setNotFoundMessage(null);

        try {
            const response = await fetch('/api/metaapi-lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ metaApiAccountId: accountId.trim() }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to lookup MetaAPI account');
            }

            if (result.success) {
                setConnectionInfo(result.connectionInfo);
                setUserDetails(result.user);
                setFoundInInstance(result.foundInInstance);
            } else {
                setNotFoundMessage(result.message || 'Account not found');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred while searching');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp: number | string | null) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleString();
    };

    const formatMetadata = (metadata: any) => {
        if (!metadata || Object.keys(metadata).length === 0) return 'None';
        return JSON.stringify(metadata, null, 2);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8 pt-16 md:pt-8">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 md:p-8 mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        MetaAPI Account Lookup
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Enter a MetaAPI account ID to find the user who owns it
                    </p>

                    {/* Search Form */}
                    <form onSubmit={handleSearch} className="mb-6">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    MetaAPI Account ID
                                </label>
                                <input
                                    type="text"
                                    value={accountId}
                                    onChange={(e) => setAccountId(e.target.value)}
                                    placeholder="Enter MetaAPI account ID (e.g., abc12345-def6-7890-ghij-klmnopqrstuv)"
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm font-mono"
                                    required
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Searching...' : 'Lookup User'}
                                </button>
                            </div>
                        </div>
                    </form>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-red-800 dark:text-red-400 font-medium">Error:</p>
                            <p className="text-red-600 dark:text-red-300 text-sm mt-1">{error}</p>
                        </div>
                    )}

                    {notFoundMessage && (
                        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-yellow-800 dark:text-yellow-400 font-medium">
                                {notFoundMessage}
                            </p>
                        </div>
                    )}

                    {foundInInstance && (
                        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <p className="text-green-800 dark:text-green-400 font-medium">
                                ✓ User found in: {foundInInstance}
                            </p>
                        </div>
                    )}
                </div>

                {/* Connection Info */}
                {connectionInfo && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 md:p-8 mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                            MetaAPI Connection Details
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <p className="text-sm text-gray-500 dark:text-gray-400">User ID</p>
                                <p className="text-gray-900 dark:text-white font-mono text-sm break-all">
                                    {connectionInfo.userId}
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Account ID</p>
                                <p className="text-gray-900 dark:text-white font-mono text-sm break-all">
                                    {connectionInfo.accountId}
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                                <p className={`font-medium ${connectionInfo.connected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {connectionInfo.connected ? '● Connected' : '○ Disconnected'}
                                </p>
                            </div>
                            {connectionInfo.brokerName && (
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Broker</p>
                                    <p className="text-gray-900 dark:text-white">{connectionInfo.brokerName}</p>
                                </div>
                            )}
                            {connectionInfo.server && (
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Server</p>
                                    <p className="text-gray-900 dark:text-white">{connectionInfo.server}</p>
                                </div>
                            )}
                            {connectionInfo.platform && (
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Platform</p>
                                    <p className="text-gray-900 dark:text-white">{connectionInfo.platform}</p>
                                </div>
                            )}
                            {connectionInfo.region && (
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Region</p>
                                    <p className="text-gray-900 dark:text-white">{connectionInfo.region}</p>
                                </div>
                            )}
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Last Updated</p>
                                <p className="text-gray-900 dark:text-white">
                                    {formatDate(connectionInfo.lastUpdated)}
                                </p>
                            </div>
                        </div>

                        {/* Raw Metadata */}
                        {connectionInfo.metadata && Object.keys(connectionInfo.metadata).length > 0 && (
                            <div className="mt-6">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Raw Metadata
                                </p>
                                <pre className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs text-gray-900 dark:text-white overflow-x-auto">
                                    {formatMetadata(connectionInfo.metadata)}
                                </pre>
                            </div>
                        )}
                    </div>
                )}

                {/* User Details */}
                {userDetails && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 md:p-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                            User Details
                        </h2>

                        <div className="space-y-6">
                            {/* Basic Information */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                                    Basic Information
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">User ID</p>
                                        <p className="text-gray-900 dark:text-white font-mono text-sm">
                                            {userDetails.id}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Username</p>
                                        <p className="text-gray-900 dark:text-white">
                                            {userDetails.username || 'N/A'}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">First Name</p>
                                        <p className="text-gray-900 dark:text-white">
                                            {userDetails.firstName || 'N/A'}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Last Name</p>
                                        <p className="text-gray-900 dark:text-white">
                                            {userDetails.lastName || 'N/A'}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Has Image</p>
                                        <p className="text-gray-900 dark:text-white">
                                            {userDetails.hasImage ? 'Yes' : 'No'}
                                        </p>
                                    </div>
                                    {userDetails.imageUrl && (
                                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Avatar</p>
                                            <img
                                                src={userDetails.imageUrl}
                                                alt="User avatar"
                                                className="w-12 h-12 rounded-full mt-1"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Email Addresses */}
                            {userDetails.emailAddresses && userDetails.emailAddresses.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                                        Email Addresses
                                    </h3>
                                    <div className="space-y-2">
                                        {userDetails.emailAddresses.map((email) => (
                                            <div
                                                key={email.id}
                                                className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                            >
                                                <p className="text-gray-900 dark:text-white font-medium">
                                                    {email.emailAddress}
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    ID: {email.id}
                                                    {userDetails.primaryEmailAddressId === email.id && (
                                                        <span className="ml-2 text-blue-600 dark:text-blue-400">
                                                            (Primary)
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Phone Numbers */}
                            {userDetails.phoneNumbers && userDetails.phoneNumbers.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                                        Phone Numbers
                                    </h3>
                                    <div className="space-y-2">
                                        {userDetails.phoneNumbers.map((phone) => (
                                            <div
                                                key={phone.id}
                                                className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                            >
                                                <p className="text-gray-900 dark:text-white font-medium">
                                                    {phone.phoneNumber}
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    ID: {phone.id}
                                                    {userDetails.primaryPhoneNumberId === phone.id && (
                                                        <span className="ml-2 text-blue-600 dark:text-blue-400">
                                                            (Primary)
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Security Settings */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                                    Security Settings
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Password Enabled</p>
                                        <p className="text-gray-900 dark:text-white">
                                            {userDetails.passwordEnabled ? 'Yes' : 'No'}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Two Factor Enabled</p>
                                        <p className="text-gray-900 dark:text-white">
                                            {userDetails.twoFactorEnabled ? 'Yes' : 'No'}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Banned</p>
                                        <p className="text-gray-900 dark:text-white">
                                            {userDetails.banned ? 'Yes' : 'No'}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Locked</p>
                                        <p className="text-gray-900 dark:text-white">
                                            {userDetails.locked ? 'Yes' : 'No'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* External Accounts */}
                            {userDetails.externalAccounts && userDetails.externalAccounts.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                                        External Accounts
                                    </h3>
                                    <div className="space-y-2">
                                        {userDetails.externalAccounts.map((account) => (
                                            <div
                                                key={account.id}
                                                className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                            >
                                                <p className="text-gray-900 dark:text-white font-medium">
                                                    {account.provider} - {account.providerUserId}
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    {account.emailAddress && `Email: ${account.emailAddress}`}
                                                    {account.username && ` | Username: ${account.username}`}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Timestamps */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                                    Timestamps
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Created At</p>
                                        <p className="text-gray-900 dark:text-white">
                                            {formatDate(userDetails.createdAt)}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Updated At</p>
                                        <p className="text-gray-900 dark:text-white">
                                            {formatDate(userDetails.updatedAt)}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Last Sign In</p>
                                        <p className="text-gray-900 dark:text-white">
                                            {formatDate(userDetails.lastSignInAt)}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Last Active</p>
                                        <p className="text-gray-900 dark:text-white">
                                            {formatDate(userDetails.lastActiveAt)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Metadata */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                                    Metadata
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Public Metadata
                                        </p>
                                        <pre className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs text-gray-900 dark:text-white overflow-x-auto">
                                            {formatMetadata(userDetails.publicMetadata)}
                                        </pre>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Unsafe Metadata
                                        </p>
                                        <pre className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs text-gray-900 dark:text-white overflow-x-auto">
                                            {formatMetadata(userDetails.unsafeMetadata)}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* No user details but have connection info */}
                {connectionInfo && !userDetails && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 md:p-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                            User Details
                        </h2>
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-yellow-800 dark:text-yellow-400 font-medium">
                                MetaAPI connection found for user ID {connectionInfo.userId}, but user details could not be fetched from Clerk.
                            </p>
                            <p className="text-yellow-600 dark:text-yellow-300 text-sm mt-1">
                                The user may exist in a Clerk instance not configured in this tool.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
