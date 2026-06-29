import { Configuration, PopupRequest } from "@azure/msal-browser";

export const msalConfig: Configuration = {
    auth: {
        clientId: process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID || "",
        authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID || "common"}`,
        redirectUri: typeof window !== "undefined" ? window.location.origin : "/",
    },
    cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false,
    },
};

export const loginRequest: PopupRequest = {
    scopes: ["User.Read", "offline_access"]
};

export const tokenRequest = {
    scopes: [
        process.env.NEXT_PUBLIC_AZURE_AD_SCOPE || `api://${process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID}/user_impersonation`
    ],
    forceRefresh: false
};

// Grafana API token request - uses Azure Managed Grafana's resource ID
export const grafanaTokenRequest = {
    scopes: ["https://grafana.azure.com/.default"],
    forceRefresh: false
};
