'use client';

import { useState, useEffect } from 'react';

interface ClerkInstance {
  id: string;
  name: string;
  publishableKey: string;
  secretKey: string;
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
  totpEnabled: boolean;
  backupCodeEnabled: boolean;
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
  samlAccounts: any[];
  web3Wallets: any[];
  createdAt: number;
  updatedAt: number;
  lastSignInAt: number | null;
  banned: boolean;
  locked: boolean;
  lockoutExpiresInSeconds: number | null;
  verificationAttemptsRemaining: number | null;
  deleteSelfEnabled: boolean;
  createOrganizationEnabled: boolean;
  lastActiveAt: number | null;
}

const STORAGE_KEY = 'clerk-instances';

const DEFAULT_INSTANCES: ClerkInstance[] = [
  {
    id: 'default-1',
    name: 'Dev Account',
    publishableKey: 'pk_test_Y3Jpc3Atb3J5eC05NC5jbGVyay5hY2NvdW50cy5kZXYk',
    secretKey: '', // Handled by server
  },
  {
    id: 'default-2',
    name: 'Live Account (VibeTrader)',
    publishableKey: 'pk_live_Y2xlcmsudmliZXRyYWRlci5jb20k',
    secretKey: '', // Handled by server
  }
];

export default function ClerkSearchPage() {
  const [instances, setInstances] = useState<ClerkInstance[]>(DEFAULT_INSTANCES);
  const [newInstance, setNewInstance] = useState({
    publishableKey: '',
    secretKey: '',
  });
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [foundInInstance, setFoundInInstance] = useState<string | null>(null);
  const [notFoundMessage, setNotFoundMessage] = useState<string | null>(null);

  // Load instances from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedInstances = localStorage.getItem(STORAGE_KEY);
        if (savedInstances) {
          const parsed = JSON.parse(savedInstances);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setInstances(parsed);
          }
        }
      } catch (error) {
        console.error('Error loading instances from localStorage:', error);
      }
    }
  }, []);

  // Save instances to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if (instances.length > 0) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(instances));
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        console.error('Error saving instances to localStorage:', error);
      }
    }
  }, [instances]);

  const addInstance = () => {
    if (!newInstance.publishableKey.trim() || !newInstance.secretKey.trim()) {
      setError('Publishable key and secret key are required');
      return;
    }

    // Check if instance with same publishable key already exists
    const existingInstance = instances.find(
      (inst) => inst.publishableKey === newInstance.publishableKey.trim()
    );
    if (existingInstance) {
      setError('An instance with this publishable key already exists');
      return;
    }

    const instance: ClerkInstance = {
      id: Date.now().toString(),
      name: `Instance ${instances.length + 1}`,
      publishableKey: newInstance.publishableKey.trim(),
      secretKey: newInstance.secretKey.trim(),
    };

    setInstances([...instances, instance]);
    setNewInstance({ publishableKey: '', secretKey: '' });
    setError(null);
  };

  const removeInstance = (id: string) => {
    setInstances(instances.filter((inst) => inst.id !== id));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (instances.length === 0) {
      setError('Please add at least one Clerk instance');
      return;
    }

    if (!userId.trim()) {
      setError('Please enter a user ID');
      return;
    }

    setLoading(true);
    setError(null);
    setUserDetails(null);
    setFoundInInstance(null);
    setNotFoundMessage(null);

    try {
      const response = await fetch('/api/clerk-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: instances.map((inst) => ({
            id: inst.id,
            name: inst.name,
            publishableKey: inst.publishableKey,
            secretKey: inst.secretKey,
          })),
          userId: userId.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to search for user');
      }

      if (result.success && result.user) {
        setUserDetails(result.user);
        setFoundInInstance(result.foundInInstance);
      } else {
        setNotFoundMessage(result.message || 'User not found');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while searching');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number | null) => {
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
            Clerk User Search
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Search for users across multiple Clerk instances
          </p>

          {/* Add Instance Form */}
          <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Add Clerk Instance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Publishable Key *
                </label>
                <input
                  type="text"
                  value={newInstance.publishableKey}
                  onChange={(e) =>
                    setNewInstance({
                      ...newInstance,
                      publishableKey: e.target.value,
                    })
                  }
                  placeholder="pk_test_..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Secret Key *
                </label>
                <input
                  type="password"
                  value={newInstance.secretKey}
                  onChange={(e) =>
                    setNewInstance({
                      ...newInstance,
                      secretKey: e.target.value,
                    })
                  }
                  placeholder="sk_test_..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
            </div>
            <button
              onClick={addInstance}
              className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
            >
              Add Instance
            </button>
          </div>

          {/* Instances List */}
          {instances.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Configured Instances ({instances.length})
              </h2>
              <div className="space-y-2">
                {instances.map((instance) => (
                  <div
                    key={instance.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {instance.name}
                      </span>
                      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 font-mono">
                        {instance.publishableKey.substring(0, 25)}...
                      </span>
                    </div>
                    <button
                      onClick={() => removeInstance(instance.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search Form */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  User ID
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Enter user ID to search"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                  required
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={loading || instances.length === 0}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
                >
                  {loading ? 'Searching...' : 'Search User'}
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
                    <p className="text-sm text-gray-500 dark:text-gray-400">Image URL</p>
                    <p className="text-gray-900 dark:text-white break-all">
                      {userDetails.imageUrl || 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Has Image</p>
                    <p className="text-gray-900 dark:text-white">
                      {userDetails.hasImage ? 'Yes' : 'No'}
                    </p>
                  </div>
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
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Password Enabled
                    </p>
                    <p className="text-gray-900 dark:text-white">
                      {userDetails.passwordEnabled ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Two Factor Enabled
                    </p>
                    <p className="text-gray-900 dark:text-white">
                      {userDetails.twoFactorEnabled ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400">TOTP Enabled</p>
                    <p className="text-gray-900 dark:text-white">
                      {userDetails.totpEnabled ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Backup Code Enabled
                    </p>
                    <p className="text-gray-900 dark:text-white">
                      {userDetails.backupCodeEnabled ? 'Yes' : 'No'}
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
              {userDetails.externalAccounts &&
                userDetails.externalAccounts.length > 0 && (
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
      </div>
    </div>
  );
}

