'use client';

import { useState, useEffect } from 'react';
import { LinkHeader } from './_components/LinkHeader';
import { LinkForm } from './_components/LinkForm';
import { LinkTable } from './_components/LinkTable';
import { PaginationControls } from './_components/PaginationControls';
import { MarketingLink } from './_components/types';

export default function LinkTracker() {
    const [links, setLinks] = useState<MarketingLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Pagination & Search state
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalLinks, setTotalLinks] = useState(0);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1); // Reset to first page on new search
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        fetchLinks();
    }, [page, debouncedSearch]);

    const fetchLinks = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                search: debouncedSearch,
                limit: '20'
            });
            const res = await fetch(`/api/marketing-links?${params}`);
            if (!res.ok) throw new Error('Failed to fetch links');
            const data = await res.json();
            setLinks(data.links);
            setTotalPages(data.pagination.totalPages);
            setTotalLinks(data.pagination.total);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this link?')) return;

        try {
            const res = await fetch(`/api/marketing-links/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete link');
            setSuccess('Link deleted successfully');
            fetchLinks();
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] p-4 md:p-8 pt-20">
            <div className="max-w-6xl mx-auto space-y-8">
                <LinkHeader />

                <LinkForm onSuccess={fetchLinks} />

                <div className="space-y-0">
                    <LinkTable
                        links={links}
                        loading={loading}
                        search={search}
                        onSearchChange={setSearch}
                        onDelete={handleDelete}
                    />

                    <PaginationControls
                        page={page}
                        totalPages={totalPages}
                        totalLinks={totalLinks}
                        onPageChange={setPage}
                    />
                </div>
            </div>
        </div>
    );
}
