"use client";

import { useState, useEffect } from 'react';
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

    const [employeeAccount, setEmployeeAccount] = useState<string | null>(null);
    const [showEmployeeForm, setShowEmployeeForm] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Persistence
    useEffect(() => {
        const saved = localStorage.getItem('employee_session');
        if (saved) setEmployeeAccount(saved);
    }, []);

    const handleEmployeeLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const allowedEmployees = [
            { email: 'gowtham@vibetradingai.com', password: 'Gowtham@video' },
            { email: 'kalyani@vibetradingai.com', password: 'kalyani@video' },
            { email: 'ketki@vibetrader.com', password: 'ketki@designer' },
            { email: 'tony@vibetradingai.com', password: 'Tony@trading' },
            { email: 'saranya@vibetrader.com', password: 'Saranya@vibetrader' }
        ];

        const match = allowedEmployees.find(emp => emp.email === email && emp.password === password);

        if (match) {
            setEmployeeAccount(email);
            localStorage.setItem('employee_session', email);
        } else {
            setError('Invalid employee credentials');
        }
    };

    const isAuthenticated = accounts.length > 0 || !!employeeAccount;

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
                    <main className="min-w-0 flex-1 bg-background p-4">
                        {children}
                    </main>
                </SidebarInset>
            </SidebarProvider>
        );
    }

    if (!isAuthenticated && showEmployeeForm) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
                <div className="relative w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-xl">
                    <div className="absolute right-4 top-4">
                        <ThemeToggle />
                    </div>
                    <div className="text-center space-y-2">
                        <h1 className="text-3xl font-bold text-card-foreground">Employee Access</h1>
                        <p className="text-muted-foreground text-sm">Enter your internal credentials</p>
                    </div>

                    <form onSubmit={handleEmployeeLogin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="name@vibetradingai.com"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            />
                        </div>

                        {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

                        <button
                            type="submit"
                            className="w-full rounded-lg bg-blue-600 px-8 py-2.5 font-semibold text-white shadow-md transition-all hover:bg-blue-700"
                        >
                            Verify & Log In
                        </button>
                    </form>

                    <button
                        onClick={() => setShowEmployeeForm(false)}
                        className="w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        ← Back to Microsoft Login
                    </button>
                </div>
            </div>
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
                <div className="space-y-3">
                    <button
                        onClick={handleMicrosoftLogin}
                        className="flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white shadow-md transition-all hover:scale-105 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-card"
                    >
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 21 21">
                            <path d="M0 0h10.5v10.5H0V0zm10.5 0H21v10.5H10.5V0zM0 10.5h10.5V21H0V10.5zm10.5 0H21V21H10.5V10.5z" />
                        </svg>
                        <span>Sign in with Microsoft</span>
                    </button>

                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border"></span>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">Or</span>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowEmployeeForm(true)}
                        className="flex w-full items-center justify-center space-x-2 rounded-lg border border-border bg-background px-8 py-2.5 text-sm font-semibold hover:bg-muted transition-colors"
                    >
                        <span>Sign in as Employee</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
