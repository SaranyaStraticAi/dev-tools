'use client';

import { useState, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { grafanaTokenRequest } from '@/lib/authConfig';

export function useGrafanaToken() {
  const { instance, accounts } = useMsal();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getGrafanaToken = useCallback(async (): Promise<string | null> => {
    if (accounts.length === 0) {
      setError('No authenticated user');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try to get token silently first
      const response = await instance.acquireTokenSilent({
        ...grafanaTokenRequest,
        account: accounts[0],
      });

      setIsLoading(false);
      return response.accessToken;
    } catch (silentError) {
      // If silent fails, try interactive
      try {
        const response = await instance.acquireTokenPopup(grafanaTokenRequest);
        setIsLoading(false);
        return response.accessToken;
      } catch (interactiveError) {
        setIsLoading(false);
        setError('Failed to acquire Grafana token');
        console.error('Grafana token error:', interactiveError);
        return null;
      }
    }
  }, [instance, accounts]);

  return {
    getGrafanaToken,
    isLoading,
    error,
  };
}
