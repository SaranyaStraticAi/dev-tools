"use client";

import { useMsal } from "@azure/msal-react";
import { loginRequest } from "@/lib/authConfig";
import AppSidebar from "./Sidebar";
import { Lock } from "lucide-react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import ThemeToggle from "./ThemeToggle";

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { instance, accounts } = useMsal();

    const handleMicrosoftLogin = () => {
        instance.loginPopup(loginRequest).catch(e => {
            console.error(e);
        });
    };

    const isAuthenticated = accounts.length > 0;

    if (isAuthenticated) {
        return (
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                    <header className="flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                        <div className="flex items-center gap-2">
                            <SidebarTrigger className="-ml-2" />
                        </div>
                        <div className="flex items-center gap-4">
                            <ThemeToggle />
                        </div>
                    </header>
                    <main className="flex-1 bg-background p-4">
                        {children}
                    </main>
                </SidebarInset>
            </SidebarProvider>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
            <div className="relative max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
                <div className="inline-block rounded-full bg-blue-600 p-4 shadow-lg">
                    <Lock className="text-white w-12 h-12" />
                </div>
                <div className="absolute right-4 top-4">
                    <ThemeToggle />
                </div>
                <h1 className="text-3xl font-bold text-card-foreground">Dev Tools Access</h1>
                <p className="text-muted-foreground">
                    Sign in with your corporate Microsoft account to continue.
                </p>
                <button
                    onClick={handleMicrosoftLogin}
                    className="flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white shadow-md transition-all hover:scale-105 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-card"
                >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 21 21">
                        <path d="M0 0h10.5v10.5H0V0zm10.5 0H21v10.5H10.5V0zM0 10.5h10.5V21H0V10.5zm10.5 0H21V21H10.5V10.5z" />
                    </svg>
                    <span>Sign in with Microsoft</span>
                </button>
            </div>
        </div>
    );
}
