import { useState, useEffect } from "react";
import { Copy, Download, FileJson, GitCompare, ArrowRight } from "lucide-react";
import { useToast } from "@/app/components/ToastContext";
import { fetchEnv } from "./ApiClient";

interface EnvData {
    project: string;
    service: string;
    environment: string;
    version: number;
    change_reason: string;
    variables: Record<string, string | number>;
}

interface EnvViewerProps {
    data: EnvData | null;
    onEdit: () => void;
}

type DiffType = "added" | "removed" | "changed" | "unchanged";

interface DiffItem {
    key: string;
    oldValue?: string;
    newValue?: string;
    type: DiffType;
}

export default function EnvViewer({ data, onEdit }: EnvViewerProps) {
    const { showToast } = useToast();
    const [showDiff, setShowDiff] = useState(false);
    const [diffs, setDiffs] = useState<DiffItem[]>([]);
    const [loadingDiff, setLoadingDiff] = useState(false);

    // Reset diff view when data changes
    useEffect(() => {
        setShowDiff(false);
        setDiffs([]);
    }, [data]);

    useEffect(() => {
        if (!showDiff || !data || data.version <= 1) return;

        const loadDiff = async () => {
            setLoadingDiff(true);
            try {
                console.log("Fetching version", data.version - 1);
                const prevData = await fetchEnv(data.project, data.service, data.environment, data.version - 1);
                console.log("Prev Data:", prevData);

                const currentVars = data.variables;
                const prevVars = prevData ? prevData.variables : {};

                const allKeys = new Set([...Object.keys(currentVars), ...Object.keys(prevVars)]);
                const computedDiffs: DiffItem[] = [];

                allKeys.forEach(key => {
                    const curr = currentVars[key] !== undefined ? String(currentVars[key]) : undefined;
                    const prev = prevVars[key] !== undefined ? String(prevVars[key]) : undefined;

                    console.log(`Key: ${key}, Curr: ${curr}, Prev: ${prev}`);

                    if (curr !== undefined && prev === undefined) {
                        computedDiffs.push({ key, newValue: curr, type: "added" });
                    } else if (curr === undefined && prev !== undefined) {
                        computedDiffs.push({ key, oldValue: prev, type: "removed" });
                    } else if (curr !== prev) {
                        computedDiffs.push({ key, oldValue: prev, newValue: curr, type: "changed" });
                    } else {
                        computedDiffs.push({ key, newValue: curr, type: "unchanged" });
                    }
                });

                console.log("Computed Diffs:", computedDiffs);


                // Sort: Added/Removed/Changed first, then alphabetical
                computedDiffs.sort((a, b) => {
                    if (a.type === "unchanged" && b.type !== "unchanged") return 1;
                    if (a.type !== "unchanged" && b.type === "unchanged") return -1;
                    return a.key.localeCompare(b.key);
                });

                setDiffs(computedDiffs);
            } catch (error) {
                console.error("Failed to load previous version", error);
                showToast("Failed to load comparison", "error");
                setShowDiff(false);
            } finally {
                setLoadingDiff(false);
            }
        };

        loadDiff();
    }, [showDiff, data, showToast]);

    if (!data) return <div className="p-8 text-gray-400">Select an environment to view</div>;

    const sortedVars = Object.entries(data.variables || {}).sort((a, b) => a[0].localeCompare(b[0]));

    const formatEnv = () => sortedVars.map(([k, v]) => `${k}=${v}`).join("\n");
    const formatJson = () => JSON.stringify(data.variables, null, 2);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast("Copied to clipboard!", "success");
    };

    const handleDownload = () => {
        const text = formatEnv();
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${data.project}-${data.service}-${data.environment}.env`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-6 bg-white shadow-sm rounded-lg border">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-xl font-bold">{data.project} / {data.service.replace(/\/$/, "")} / {data.environment}</h2>
                    <div className="text-sm text-gray-500 mt-1">
                        Version <span className="font-mono bg-gray-100 px-1 rounded">{data.version}</span>
                        <span className="mx-2">•</span>
                        Reason: {data.change_reason}
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                    {data.version > 1 && (
                        <button
                            onClick={() => setShowDiff(!showDiff)}
                            className={`flex items-center px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${showDiff
                                ? "bg-purple-100 text-purple-700 border-purple-200"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                            title="Compare with previous version"
                        >
                            <GitCompare size={14} className="mr-1.5" />
                            {showDiff ? "Hide Changes" : "Show Changes"}
                        </button>
                    )}

                    {!showDiff && (
                        <>
                            <button
                                onClick={() => handleCopy(formatEnv())}
                                className="flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border"
                                title="Copy as .env format"
                            >
                                <Copy size={14} className="mr-1.5" />
                                .env
                            </button>
                            <button
                                onClick={() => handleCopy(formatJson())}
                                className="flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border"
                                title="Copy as JSON"
                            >
                                <FileJson size={14} className="mr-1.5" />
                                JSON
                            </button>
                            <button
                                onClick={handleDownload}
                                className="flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200"
                                title="Download as .env file"
                            >
                                <Download size={14} className="mr-1.5" />
                                Download
                            </button>
                            <button
                                onClick={onEdit}
                                className="flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
                                title="Edit Environment"
                            >
                                Edit
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto">
                {showDiff ? (
                    loadingDiff ? (
                        <div className="text-center py-8 text-gray-500 animate-pulse">Calculating differences...</div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="py-2 px-4 font-semibold text-gray-600 w-1/4">Key</th>
                                    <th className="py-2 px-4 font-semibold text-gray-600">Change</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {diffs.map((diff) => (
                                    <tr key={diff.key} className={`
                                    ${diff.type === 'added' ? 'bg-green-50' : ''}
                                    ${diff.type === 'removed' ? 'bg-red-50' : ''}
                                    ${diff.type === 'changed' ? 'bg-yellow-50' : ''}
                                    hover:bg-opacity-80
                                `}>
                                        <td className="py-2 px-4 font-mono font-medium">
                                            {diff.type === 'added' && <span className="text-green-600 mr-2 font-bold">+</span>}
                                            {diff.type === 'removed' && <span className="text-red-600 mr-2 font-bold">-</span>}
                                            {diff.type === 'changed' && <span className="text-yellow-600 mr-2 font-bold">~</span>}
                                            {diff.key}
                                        </td>
                                        <td className="py-2 px-4 font-mono break-all">
                                            {diff.type === 'added' && <div className="text-green-700">{diff.newValue}</div>}
                                            {diff.type === 'removed' && <div className="text-red-700 line-through">{diff.oldValue}</div>}
                                            {diff.type === 'changed' && (
                                                <div className="flex items-center flex-wrap gap-2">
                                                    <span className="bg-red-100 text-red-700 px-1 rounded line-through text-xs">{diff.oldValue}</span>
                                                    <ArrowRight size={12} className="text-gray-400" />
                                                    <span className="bg-green-100 text-green-700 px-1 rounded">{diff.newValue}</span>
                                                </div>
                                            )}
                                            {diff.type === 'unchanged' && <div className="text-gray-500">{diff.newValue}</div>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="py-2 px-4 font-semibold text-gray-600 w-1/4">Key</th>
                                <th className="py-2 px-4 font-semibold text-gray-600">Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {sortedVars.map(([key, value]) => (
                                <tr key={key} className="hover:bg-gray-50">
                                    <td className="py-2 px-4 font-mono text-purple-600">{key}</td>
                                    <td className="py-2 px-4 font-mono text-gray-800 break-all">{String(value)}</td>
                                </tr>
                            ))}
                            {sortedVars.length === 0 && (
                                <tr>
                                    <td colSpan={2} className="py-4 px-4 text-center text-gray-400">No variables found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
