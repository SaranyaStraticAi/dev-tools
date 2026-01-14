"use client";

import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from "@azure/msal-react";
import { loginRequest } from "@/lib/authConfig";
import Sidebar from "./Sidebar";
import { Lock } from "lucide-react";

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { instance } = useMsal();

    const handleLogin = () => {
        instance.loginPopup(loginRequest).catch(e => {
            console.error(e);
        });
    };

    return (
        <>
            <AuthenticatedTemplate>
                <Sidebar />
                <main className="md:ml-64 min-h-screen">
                    {children}
                </main>
            </AuthenticatedTemplate>
            <UnauthenticatedTemplate>
                <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                    <div className="text-center space-y-6 max-w-md px-4">
                        <div className="bg-blue-600 p-4 rounded-full inline-block shadow-lg">
                            <Lock className="text-white w-12 h-12" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900">Dev Tools Access</h1>
                        <p className="text-gray-500">
                            Please sign in with your Microsoft account to access the developer tools and environment manager.
                        </p>
                        <button
                            onClick={handleLogin}
                            className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md transition-all hover:scale-105 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            <svg className="w-5 h-5 fill-current" viewBox="0 0 21 21">
                                <path d="M0 0h10.5v10.5H0V0zm10.5 0H21v10.5H10.5V0zM0 10.5h10.5V21H0V10.5zm10.5 0H21V21H10.5V10.5z" />
                            </svg>
                            <span>Sign in with Microsoft</span>
                        </button>
                    </div>
                </div>
            </UnauthenticatedTemplate>
        </>
    );
}
