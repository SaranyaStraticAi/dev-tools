"use client";

import { useMsal } from "@azure/msal-react";
import { loginRequest } from "@/lib/authConfig";
import AppSidebar from "./Sidebar";
import { Lock } from "lucide-react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { SignInButton, useUser, UserButton, useClerk } from "@clerk/nextjs";

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { instance, accounts } = useMsal();
    const { isSignedIn, isLoaded, user } = useUser();
    const { signOut } = useClerk();

    const handleMicrosoftLogin = () => {
        instance.loginPopup(loginRequest).catch(e => {
            console.error(e);
        });
    };

    // Combine authentication states
    const isMsalAuthenticated = accounts.length > 0;

    // Check if Clerk user is allowed
    const allowedEmails = (process.env.NEXT_PUBLIC_ALLOWED_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
    const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
    const isClerkAllowed = isSignedIn && userEmail && allowedEmails.includes(userEmail);

    const isAuthenticated = isMsalAuthenticated || isClerkAllowed;
    const isClerkAuthButDenied = isSignedIn && !isClerkAllowed;

    // Show nothing while loading Clerk state to prevent flicker
    if (!isLoaded) {
        return null;
    }

    if (isAuthenticated) {
        return (
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                    <header className="flex h-14 items-center justify-between border-b px-4">
                        <div className="flex items-center gap-2">
                            <SidebarTrigger className="-ml-2" />
                        </div>
                        <div className="flex items-center gap-4">
                            {isSignedIn && <UserButton afterSignOutUrl="/" />}
                        </div>
                    </header>
                    <main className="flex-1 p-4">
                        {children}
                    </main>
                </SidebarInset>
            </SidebarProvider>
        );
    }

    if (isClerkAuthButDenied) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center space-y-6 max-w-md px-4">
                    <div className="bg-red-100 p-4 rounded-full inline-block shadow-sm">
                        <Lock className="text-red-600 w-12 h-12" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">Access Denied</h1>
                    <p className="text-gray-500">
                        The account <strong>{userEmail}</strong> is not authorized to access these tools.
                        Please contact the administrator for access.
                    </p>
                    <button
                        onClick={() => signOut()}
                        className="w-full flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md transition-all hover:scale-105"
                    >
                        <span>Sign out and try again</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
            <div className="text-center space-y-6 max-w-md px-4">
                <div className="bg-blue-600 p-4 rounded-full inline-block shadow-lg">
                    <Lock className="text-white w-12 h-12" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900">Dev Tools Access</h1>
                <p className="text-gray-500">
                    Sign in with your corporate Microsoft account or use an authorized add-on account.
                </p>

                <div className="space-y-3">
                    <button
                        onClick={handleMicrosoftLogin}
                        className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md transition-all hover:scale-105 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 21 21">
                            <path d="M0 0h10.5v10.5H0V0zm10.5 0H21v10.5H10.5V0zM0 10.5h10.5V21H0V10.5zm10.5 0H21V21H10.5V10.5z" />
                        </svg>
                        <span>Sign in with Microsoft</span>
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-gray-300" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-gray-50 px-2 text-gray-500 font-medium">Or authorized add-on</span>
                        </div>
                    </div>

                    <SignInButton mode="modal">
                        <button className="w-full flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold py-3 px-8 rounded-lg shadow-sm transition-all hover:scale-105 focus:ring-2 focus:ring-gray-300 focus:ring-offset-2">
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            <span>Sign in with Google / Email</span>
                        </button>
                    </SignInButton>
                </div>
            </div>
        </div>
    );
}
