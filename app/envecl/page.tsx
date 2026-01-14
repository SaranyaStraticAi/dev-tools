"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, Lock } from "lucide-react";
import Explorer from "./components/Explorer";
import EnvViewer from "./components/EnvViewer";
import EnvEditor from "./components/EnvEditor";
import HistoryTable from "./components/HistoryTable";
import { fetchEnv, fetchHistory, pushEnv } from "./components/ApiClient";
import { useToast } from "@/app/components/ToastContext";

// MSAL Imports
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from "@azure/msal-react";
import { loginRequest } from "@/lib/authConfig";

interface EnvData {
    project: string;
    service: string;
    environment: string;
    version: number;
    change_reason: string;
    variables: Record<string, string | number>;
}

interface HistoryItem {
    version: number;
    created_at: string;
    created_by: string;
    change_reason: string;
}

export default function EnveclPage() {
    const { instance } = useMsal();
    const [selected, setSelected] = useState<{ p: string, s: string, e: string } | null>(null);
    const [data, setData] = useState<EnvData | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [version, setVersion] = useState<number | undefined>(undefined);

    const [isEditing, setIsEditing] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const { showToast } = useToast();

    const handleLogin = () => {
        instance.loginPopup(loginRequest).catch(e => {
            showToast("Login Failed: " + e.message, "error");
        });
    };

    const handleSelectEnv = (p: string, s: string, e: string) => {
        setSelected({ p, s, e });
        setVersion(undefined);
        setIsEditing(false);
        setIsCreating(false);
    };

    const loadData = useCallback(() => {
        if (!selected) return;

        fetchEnv(selected.p, selected.s, selected.e, version)
            .then(setData)
            .catch(err => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if ((err as any).message?.includes("401") || (err as any).message?.includes("Unauthorized")) {
                    showToast("Session Expired. Please login again.", "error");
                } else {
                    showToast("Failed to load: " + (err as Error).message, "error");
                }
            });

        fetchHistory(selected.p, selected.s, selected.e)
            .then(res => setHistory(res ? res.history : []))
            .catch(err => console.error(err));
    }, [selected, version, showToast]);

    useEffect(() => {
        if (isEditing || isCreating) return;
        loadData();
    }, [selected, version, isEditing, isCreating, loadData]);

    const handleCreateRef = () => {
        setIsCreating(true);
        setIsEditing(false);
        setSelected(null);
    };

    interface EnvFormData {
        project: string;
        service: string;
        environment: string;
        variables: Record<string, string>;
        change_reason: string;
    }

    const handleSave = async (formData: EnvFormData) => {
        try {
            await pushEnv(formData);
            showToast("Saved successfully!", "success");
            setIsEditing(false);
            setIsCreating(false);
            setSelected({ p: formData.project, s: formData.service, e: formData.environment });
            setVersion(undefined);
        } catch (e: unknown) {
            showToast("Failed to save: " + (e instanceof Error ? e.message : String(e)), "error");
        }
    };

    return (
        <div className="min-h-screen bg-white">
            {/* State: Not Logged In */}
            <UnauthenticatedTemplate>
                <div className="flex flex-col items-center justify-center h-[80vh] space-y-8 bg-gray-50 rounded-lg m-4">
                    <div className="text-center space-y-4">
                        <div className="bg-blue-600 p-4 rounded-full inline-block">
                            <Lock className="text-white" size={48} />
                        </div>
                        <h1 className="text-4xl font-bold text-gray-900">ENVECL <span className="text-blue-600">Secure</span></h1>
                        <p className="text-gray-500 max-w-md">Enterprise Environment Variable Management Platform</p>
                    </div>
                    <button
                        onClick={handleLogin}
                        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg transition-transform hover:scale-105"
                    >
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 21 21"><path d="M0 0h10.5v10.5H0V0zm10.5 0H21v10.5H10.5V0zM0 10.5h10.5V21H0V10.5zm10.5 0H21V21H10.5V10.5z" /></svg>
                        <span>Sign in with Microsoft</span>
                    </button>
                </div>
            </UnauthenticatedTemplate>

            {/* State: Logged In */}
            <AuthenticatedTemplate>
                <div className="flex h-[calc(100vh-4rem)] bg-white text-gray-900">
                    <div className="flex flex-col border-r bg-gray-50 w-64 flex-shrink-0">
                        <div className="flex-1 overflow-y-auto pt-4">
                            <Explorer onSelectEnv={handleSelectEnv} />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 relative">
                        {isCreating ? (
                            <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-200">
                                <EnvEditor onSave={handleSave} onCancel={() => setIsCreating(false)} />
                            </div>
                        ) : isEditing && data ? (
                            <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-200">
                                <EnvEditor
                                    initialData={data}
                                    onSave={handleSave}
                                    onCancel={() => setIsEditing(false)}
                                />
                            </div>
                        ) : selected ? (
                            <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <EnvViewer data={data} onEdit={() => setIsEditing(true)} />
                                <HistoryTable history={history} onSelectVersion={setVersion} currentVersion={data?.version} />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-8 animate-in fade-in duration-500">
                                <div className="space-y-4 flex flex-col items-center">
                                    <div className="bg-blue-50 p-6 rounded-full mb-2">
                                        <Lock className="text-blue-600" size={64} />
                                    </div>
                                    <h2 className="text-4xl font-extrabold text-gray-800 tracking-tight">
                                        Welcome to <span className="text-blue-600">ENVECL</span>
                                    </h2>
                                    <p className="text-xl text-gray-500 max-w-md mx-auto">
                                        Secure, versioned, and centralized environment variable management for your team.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-6 max-w-sm w-full">
                                    <button
                                        onClick={handleCreateRef}
                                        className="flex items-center justify-center w-full py-4 px-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all font-semibold text-lg group"
                                    >
                                        <Plus size={24} className="mr-3 group-hover:rotate-90 transition-transform" />
                                        Create New Environment
                                    </button>

                                    <div className="text-sm text-gray-400">
                                        <p>Select a project from the sidebar to manage existing secrets.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </AuthenticatedTemplate>
        </div>
    );
}
