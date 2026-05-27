'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMsal } from "@azure/msal-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Contact {
    id:           string;
    email:        string;
    first_name:   string;
    last_name:    string;
    unsubscribed: boolean;
    created_at:   string;
}

interface Segment {
    id:        string;
    name:      string;
    isDefault?: boolean;
}

type SortKey   = 'email' | 'first_name' | 'created_at';
type SortDir   = 'asc' | 'desc';
type FilterTab = 'all' | 'subscribed' | 'unsubscribed';

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AudienceManagerPage() {
    const { accounts } = useMsal();
    const [employeeAccount, setEmployeeAccount] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('employee_session');
        if (saved) setEmployeeAccount(saved);
    }, []);

    const userEmail = accounts[0]?.username;
    const isAllowed = userEmail === 'masood@aity.dev' || employeeAccount === 'ketki@vibetrader.com' || userEmail === 'ketki@vibetrader.com';

    const [contacts,    setContacts]    = useState<Contact[]>([]);
    const [segments,    setSegments]    = useState<Segment[]>([]);
    const [selectedSeg, setSelectedSeg] = useState<string | null>(null);
    const [loading,     setLoading]     = useState(true);
    const [segLoading,  setSegLoading]  = useState(false);
    const [error,       setError]       = useState('');
    const [search,      setSearch]      = useState('');
    const [filterTab,   setFilterTab]   = useState<FilterTab>('all');
    const [sortKey,     setSortKey]     = useState<SortKey>('created_at');
    const [sortDir,     setSortDir]     = useState<SortDir>('desc');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId,   setEditingId]   = useState<string | null>(null);

    // New Segment state
    const [newSegName, setNewSegName] = useState('');
    const [createSegLoading, setCreateSegLoading] = useState(false);

    // Add form state (Global Contact)
    const [newEmail,     setNewEmail]     = useState('');
    const [newFirstName, setNewFirstName] = useState('');
    const [newLastName,  setNewLastName]  = useState('');
    const [addLoading,   setAddLoading]   = useState(false);
    const [addError,     setAddError]     = useState('');

    // Assign Contact to Segment state
    const [selectedContactForSeg, setSelectedContactForSeg] = useState('');
    const [assignLoading, setAssignLoading] = useState(false);

    // Edit state
    const [editFirst, setEditFirst] = useState('');
    const [editLast,  setEditLast]  = useState('');

    // Action state (per-row)
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

    // ── Fetch Segments ────────────────────────────────────────────────────────
    const fetchSegments = useCallback(async () => {
        setSegLoading(true);
        try {
            const res  = await fetch('/api/resend-segments');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed to fetch segments');
            setSegments(data.segments ?? []);
            if (data.segments?.length > 0 && !selectedSeg) {
                setSelectedSeg(data.segments[0].id);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSegLoading(false);
        }
    }, [selectedSeg]);

    // ── Fetch contacts for selected segment ───────────────────────────────────
    const fetchContacts = useCallback(async () => {
        if (!selectedSeg) return;
        setLoading(true); setError('');
        try {
            const res  = await fetch(`/api/resend-segments/${selectedSeg}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed to fetch contacts');
            setContacts(data.contacts ?? []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [selectedSeg]);

    useEffect(() => { if (isAllowed) fetchSegments(); }, [fetchSegments, isAllowed]);
    useEffect(() => { if (isAllowed) fetchContacts(); }, [fetchContacts, isAllowed]);

    // ── Create Segment ────────────────────────────────────────────────────────
    const handleCreateSegment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSegName.trim()) return;
        setCreateSegLoading(true);
        try {
            const res = await fetch('/api/resend-segments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newSegName.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed to create segment');
            setNewSegName('');
            await fetchSegments();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setCreateSegLoading(false);
        }
    };

    // ── Delete Segment ────────────────────────────────────────────────────────
    const handleDeleteSegment = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete segment "${name}"?`)) return;
        try {
            const res = await fetch(`/api/resend-segments/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error ?? 'Failed to delete segment');
            }
            if (selectedSeg === id) setSelectedSeg(null);
            await fetchSegments();
        } catch (e: any) {
            alert(e.message);
        }
    };

    // ── Add Global Contact ────────────────────────────────────────────────────
    const handleAddContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail.trim()) { setAddError('Email is required'); return; }
        setAddLoading(true); setAddError('');
        try {
            const res  = await fetch('/api/resend-contacts', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email: newEmail.trim(), firstName: newFirstName.trim(), lastName: newLastName.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed to add contact');
            setNewEmail(''); setNewFirstName(''); setNewLastName('');
            setShowAddForm(false);
            
            // If a segment is selected, automatically add this new contact to it
            if (selectedSeg && data.contact?.id) {
                await fetch(`/api/resend-segments/${selectedSeg}/contacts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contactId: data.contact.id }),
                });
            }
            
            await fetchContacts();
        } catch (e: any) {
            setAddError(e.message);
        } finally {
            setAddLoading(false);
        }
    };

    // ── Assign Contact to Segment ──────────────────────────────────────────────
    const handleAssignToSegment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSeg || !selectedContactForSeg) return;
        setAssignLoading(true);
        try {
            const res = await fetch(`/api/resend-segments/${selectedSeg}/contacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contactId: selectedContactForSeg }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed to assign contact');
            setSelectedContactForSeg('');
            await fetchContacts();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setAssignLoading(false);
        }
    };

    // ── Remove Contact from Segment ───────────────────────────────────────────
    const handleRemoveFromSegment = async (contactId: string, email: string) => {
        if (!selectedSeg) return;
        if (!confirm(`Remove ${email} from this segment?`)) return;
        setActionLoading(p => ({ ...p, [contactId]: true }));
        try {
            const res = await fetch(`/api/resend-segments/${selectedSeg}/contacts`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contactId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed to remove contact');
            await fetchContacts();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setActionLoading(p => ({ ...p, [contactId]: false }));
        }
    };

    // ── Bulk Remove/Delete Segment Contacts ───────────────────────────────────
    const handleBulkDeleteContacts = async () => {
        if (!selectedSeg) return;
        const count = contacts.length;
        if (count === 0) {
            alert("No contacts in this segment to delete.");
            return;
        }

        const confirmBulk = confirm(`Are you sure you want to clear all ${count} contacts in this segment?`);
        if (!confirmBulk) return;

        const deletePermanently = confirm(
            "Do you want to PERMANENTLY DELETE these contacts from Resend as well?\n\n" +
            "• Click OK to permanently delete these contacts from Resend completely.\n" +
            "• Click Cancel to only remove them from this segment (they will remain in Resend)."
        );

        setLoading(true);
        try {
            const res = await fetch(`/api/resend-segments/${selectedSeg}/contacts`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ removeAll: true, deletePermanently }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed to delete contacts');
            alert(`Bulk action complete! Succeeded: ${data.succeeded}, Failed: ${data.failed}`);
            await fetchContacts();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    // ── Toggle subscribe (Global) ──────────────────────────────────────────────
    const handleToggleSub = async (contact: Contact) => {
        setActionLoading(p => ({ ...p, [contact.id]: true }));
        try {
            const res  = await fetch(`/api/resend-contacts/${contact.id}`, {
                method:  'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ unsubscribed: !contact.unsubscribed }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error ?? 'Update failed');
            }
            setContacts(cs => cs.map(c => c.id === contact.id ? { ...c, unsubscribed: !c.unsubscribed } : c));
        } catch (e: any) {
            alert(e.message);
        } finally {
            setActionLoading(p => ({ ...p, [contact.id]: false }));
        }
    };

    // ── Save name edit (Global) ───────────────────────────────────────────────
    const handleSaveEdit = async (id: string) => {
        setActionLoading(p => ({ ...p, [id]: true }));
        try {
            const res  = await fetch(`/api/resend-contacts/${id}`, {
                method:  'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ firstName: editFirst, lastName: editLast }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error ?? 'Update failed');
            }
            setContacts(cs => cs.map(c => c.id === id ? { ...c, first_name: editFirst, last_name: editLast } : c));
            setEditingId(null);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setActionLoading(p => ({ ...p, [id]: false }));
        }
    };

    // ── Filter + sort ─────────────────────────────────────────────────────────
    const filtered = contacts
        .filter(c => {
            if (filterTab === 'subscribed')   return !c.unsubscribed;
            if (filterTab === 'unsubscribed') return c.unsubscribed;
            return true;
        })
        .filter(c => {
            if (!search) return true;
            const q = search.toLowerCase();
            return c.email.toLowerCase().includes(q)
                || c.first_name.toLowerCase().includes(q)
                || c.last_name.toLowerCase().includes(q);
        })
        .sort((a, b) => {
            const va = a[sortKey] ?? '';
            const vb = b[sortKey] ?? '';
            const cmp = String(va).localeCompare(String(vb));
            return sortDir === 'asc' ? cmp : -cmp;
        });

    const totalSub   = contacts.filter(c => !c.unsubscribed).length;
    const totalUnsub = contacts.filter(c =>  c.unsubscribed).length;

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const SortIcon = ({ col }: { col: SortKey }) => (
        <span className="ml-1 opacity-50 text-[10px]">
            {sortKey === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
    );

    if (!mounted) return null;

    if (!isAllowed) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center flex flex-col gap-2">
                    <span className="text-2xl">🔒</span>
                    <p className="text-sm text-muted-foreground">Access Denied. Only Masood and Ketki are allowed.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background py-10 px-4">
            <div className="max-w-7xl mx-auto flex flex-col gap-6">

                {/* ── Header ── */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <a href="/newsletter-tester"
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                                ← Newsletter Tester
                            </a>
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            👥 Audience & Segments
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Manage your Resend contacts and organize them into segments
                        </p>
                    </div>
                </div>

                {/* ── Error banner ── */}
                {error && (
                    <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                        ❌ {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">

                    {/* ─── Left Column: Segments ──────────────────────────────── */}
                    <div className="border rounded-2xl bg-card p-5 flex flex-col gap-4 h-fit">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Segments</h2>
                            {segLoading && <span className="w-4 h-4 border-2 border-muted border-t-foreground animate-spin rounded-full"/>}
                        </div>

                        {/* Create Segment Form */}
                        <form onSubmit={handleCreateSegment} className="flex gap-2">
                            <input
                                value={newSegName}
                                onChange={e => setNewSegName(e.target.value)}
                                placeholder="New segment..."
                                className="flex-1 px-3 py-1.5 text-sm rounded-lg border bg-background focus:ring-1 focus:ring-ring outline-none"
                            />
                            <button
                                type="submit"
                                disabled={createSegLoading || !newSegName.trim()}
                                className="px-3 py-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg disabled:opacity-50 transition-colors"
                            >
                                {createSegLoading ? '…' : 'Add'}
                            </button>
                        </form>

                        {/* Segments List */}
                        <div className="flex flex-col gap-1 mt-2">
                            {segments.map(seg => (
                                <div
                                    key={seg.id}
                                    className={`group flex items-center justify-between p-2 rounded-lg text-sm cursor-pointer transition-colors ${
                                        selectedSeg === seg.id
                                            ? 'bg-orange-500/10 text-orange-500 font-medium'
                                            : 'hover:bg-muted text-foreground'
                                    }`}
                                    onClick={() => setSelectedSeg(seg.id)}
                                >
                                    <span className="truncate">
                                        📁 {seg.name}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteSegment(seg.id, seg.name);
                                        }}
                                        className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Delete segment"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            {segments.length === 0 && !segLoading && (
                                <p className="text-xs text-muted-foreground text-center py-4">No segments yet.</p>
                            )}
                        </div>
                    </div>

                    {/* ─── Right Column: Contacts ─────────────────────────────── */}
                    <div className="flex flex-col gap-6">

                        {/* Action Bar */}
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 p-1 bg-muted rounded-xl border w-fit">
                                    {(['all', 'subscribed', 'unsubscribed'] as FilterTab[]).map(tab => (
                                        <button key={tab} onClick={() => setFilterTab(tab)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${filterTab === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                            {tab === 'all' ? `All (${contacts.length})` : tab === 'subscribed' ? `Active (${totalSub})` : `Unsub (${totalUnsub})`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="🔍 Search contacts…"
                                    className="px-3 py-1.5 rounded-lg border bg-background text-sm w-full sm:w-56 focus:ring-1 focus:ring-ring outline-none"
                                />
                                {selectedSeg && contacts.length > 0 && (
                                    <button
                                        onClick={handleBulkDeleteContacts}
                                        className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-bold transition-all flex items-center gap-1"
                                        title="Clear all contacts from this segment"
                                    >
                                        🗑️ Clear Segment
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowAddForm(v => !v)}
                                    className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-all flex items-center gap-1"
                                >
                                    ➕ Create Contact
                                </button>
                            </div>
                        </div>

                        {/* Add Contact Form */}
                        {showAddForm && (
                            <form onSubmit={handleAddContact}
                                className="border border-orange-500/30 bg-orange-500/5 rounded-2xl p-4 flex flex-col gap-3 animate-in slide-in-from-top-2">
                                <h3 className="font-bold text-sm text-orange-400">
                                    ➕ New Contact {selectedSeg ? `(Will be added to "${segments.find(s => s.id === selectedSeg)?.name}" segment)` : ''}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <input required value={newEmail} onChange={e => setNewEmail(e.target.value)}
                                        placeholder="email@example.com *"
                                        className="px-3 py-1.5 rounded-lg border bg-background text-sm focus:ring-1 focus:ring-orange-500 outline-none" />
                                    <input value={newFirstName} onChange={e => setNewFirstName(e.target.value)}
                                        placeholder="First name"
                                        className="px-3 py-1.5 rounded-lg border bg-background text-sm focus:ring-1 focus:ring-orange-500 outline-none" />
                                    <input value={newLastName} onChange={e => setNewLastName(e.target.value)}
                                        placeholder="Last name"
                                        className="px-3 py-1.5 rounded-lg border bg-background text-sm focus:ring-1 focus:ring-orange-500 outline-none" />
                                </div>
                                {addError && <p className="text-red-400 text-xs">{addError}</p>}
                                <div className="flex gap-2">
                                    <button type="submit" disabled={addLoading}
                                        className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold disabled:opacity-60 transition-colors">
                                        {addLoading ? 'Adding…' : 'Add Contact'}
                                    </button>
                                    <button type="button" onClick={() => setShowAddForm(false)}
                                        className="px-4 py-1.5 rounded-lg border text-sm hover:bg-muted transition-colors">
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Table */}
                        <div className="border rounded-2xl overflow-hidden bg-card">
                            <div className="grid grid-cols-[1fr_1fr_120px_100px_80px] gap-0 border-b bg-muted/50 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                <button onClick={() => handleSort('email')}
                                    className="px-4 py-3 text-left hover:text-foreground transition-colors flex items-center">
                                    Email <SortIcon col="email"/>
                                </button>
                                <button onClick={() => handleSort('first_name')}
                                    className="px-4 py-3 text-left hover:text-foreground transition-colors flex items-center">
                                    Name <SortIcon col="first_name"/>
                                </button>
                                <button onClick={() => handleSort('created_at')}
                                    className="px-4 py-3 text-left hover:text-foreground transition-colors flex items-center">
                                    Added <SortIcon col="created_at"/>
                                </button>
                                <div className="px-4 py-3">Status</div>
                                <div className="px-4 py-3">Actions</div>
                            </div>

                            {/* Loading */}
                            {loading && (
                                <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                                    <span className="w-5 h-5 border-2 border-muted border-t-foreground animate-spin rounded-full"/>
                                    <span className="text-sm">Loading contacts...</span>
                                </div>
                            )}

                            {/* Empty */}
                            {!loading && filtered.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                                    <span className="text-3xl">👥</span>
                                    <p className="text-sm font-medium">No contacts in this segment.</p>
                                </div>
                            )}

                            {/* Rows */}
                            {!loading && filtered.map((contact, i) => (
                                <div key={contact.id}
                                    className={`grid grid-cols-[1fr_1fr_120px_100px_80px] gap-0 border-b last:border-0 transition-colors hover:bg-muted/30 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>

                                    {/* Email */}
                                    <div className="px-4 py-3 flex items-center min-w-0">
                                        <span className="text-sm font-mono truncate">{contact.email}</span>
                                    </div>

                                    {/* Name — editable */}
                                    <div className="px-4 py-3 flex items-center gap-2 min-w-0">
                                        {editingId === contact.id ? (
                                            <div className="flex items-center gap-1 w-full">
                                                <input
                                                    value={editFirst}
                                                    onChange={e => setEditFirst(e.target.value)}
                                                    placeholder="First"
                                                    className="w-20 px-2 py-1 text-xs rounded border bg-background focus:ring-1 focus:ring-ring outline-none"
                                                />
                                                <input
                                                    value={editLast}
                                                    onChange={e => setEditLast(e.target.value)}
                                                    placeholder="Last"
                                                    className="w-20 px-2 py-1 text-xs rounded border bg-background focus:ring-1 focus:ring-ring outline-none"
                                                />
                                                <button
                                                    onClick={() => handleSaveEdit(contact.id)}
                                                    disabled={actionLoading[contact.id]}
                                                    className="px-1.5 py-1 text-[10px] font-bold bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                                                    {actionLoading[contact.id] ? '…' : '✓'}
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="px-1.5 py-1 text-[10px] border rounded hover:bg-muted">
                                                    ✕
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setEditingId(contact.id);
                                                    setEditFirst(contact.first_name ?? '');
                                                    setEditLast(contact.last_name ?? '');
                                                }}
                                                className="text-sm text-left hover:underline truncate text-muted-foreground hover:text-foreground transition-colors"
                                                title="Click to edit name"
                                            >
                                                {[contact.first_name, contact.last_name].filter(Boolean).join(' ') || <span className="italic text-xs opacity-40">— no name —</span>}
                                            </button>
                                        )}
                                    </div>

                                    {/* Date added */}
                                    <div className="px-4 py-3 flex items-center">
                                        <span className="text-xs text-muted-foreground">
                                            {contact.created_at
                                                ? new Date(contact.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                                                : '—'}
                                        </span>
                                    </div>

                                    {/* Status toggle */}
                                    <div className="px-4 py-3 flex items-center">
                                        <button
                                            onClick={() => handleToggleSub(contact)}
                                            disabled={actionLoading[contact.id]}
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all disabled:opacity-50 ${
                                                contact.unsubscribed
                                                    ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                                                    : 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
                                            }`}
                                        >
                                            {actionLoading[contact.id] ? '…' : contact.unsubscribed ? 'Unsub' : 'Active'}
                                        </button>
                                    </div>

                                    {/* Delete/Remove from Segment */}
                                    <div className="px-4 py-3 flex items-center justify-center">
                                        <button
                                            onClick={() => handleRemoveFromSegment(contact.id, contact.email)}
                                            disabled={actionLoading[contact.id]}
                                            className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                                            title="Remove from segment"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
