"use client";

import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "@/lib/msalInstance";
import { ReactNode } from "react";
import { EventType } from "@azure/msal-browser";

// Set active account on page load if one exists
if (!msalInstance.getActiveAccount() && msalInstance.getAllAccounts().length > 0) {
    msalInstance.setActiveAccount(msalInstance.getAllAccounts()[0]);
}

msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const account = (event.payload as any).account;
        msalInstance.setActiveAccount(account);
    }
});

export function AuthProvider({ children }: { children: ReactNode }) {
    return (
        <MsalProvider instance={msalInstance}>
            {children}
        </MsalProvider>
    );
}
