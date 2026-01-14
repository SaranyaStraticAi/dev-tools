const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7071/api"; // Default local Azure Function port

import { msalInstance } from "@/lib/msalInstance";
import { tokenRequest } from "@/lib/authConfig";

async function getHeaders() {
    let account = msalInstance.getActiveAccount();
    if (!account) {
        // Fallback: Check if ANY accounts are logged in
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
            console.log("No active account set, forcing first account:", accounts[0].username);
            msalInstance.setActiveAccount(accounts[0]);
            account = accounts[0];
        } else {
            throw new Error("No active account! Please login.");
        }
    }

    try {
        const response = await msalInstance.acquireTokenSilent({
            ...tokenRequest,
            account: account
        });

        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${response.accessToken}`
        };
    } catch (error) {
        // If silent fails, we might need interaction, but usually ApiClient shouldn't trigger popup directly
        // Better to throw and let UI handle it, or try popup if context allows.
        // For simplicity in this helper, we'll try popup if silent fails, but warning: this might be blocked by browser if not user-initiated.
        console.error("Silent token acquisition failed", error);
        throw error;
    }
}

export async function fetchBrowse(path: string = "") {
    const res = await fetch(`${API_URL}/browse?path=${path}`, {
        headers: await getHeaders()
    });
    if (!res.ok) return { keys: [] };
    return res.json();
}

export async function fetchEnv(project: string, service: string, env: string, version?: number) {
    let url = `${API_URL}/pull?project=${project}&service=${service}&environment=${env}`;
    if (version) url += `&version=${version}`;

    const res = await fetch(url, { headers: await getHeaders() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to fetch env");
    return res.json();
}

export async function fetchHistory(project: string, service: string, env: string) {
    const res = await fetch(`${API_URL}/history?project=${project}&service=${service}&environment=${env}`, {
        headers: await getHeaders()
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to fetch history");
    return res.json();
}

export async function pushEnv(data: {
    project: string;
    service: string;
    environment: string;
    variables: Record<string, string>;
    change_reason: string;
}) {
    const res = await fetch(`${API_URL}/push`, {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(data)
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to push" }));
        throw new Error(err.detail || "Failed to push env");
    }
    return res.json();
}
