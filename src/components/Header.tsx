// src/components/Header.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FaBars, FaTimes, FaSearch } from 'react-icons/fa';
import { GiSoccerBall } from 'react-icons/gi';

const NAV_LINKS = [
    { href: '/', label: 'Home' },
    { href: '/channels', label: 'Channels' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
] as const;

export default function Header({ onSearch, searchValue = '' }: {
    onSearch?: (term: string) => void;
    searchValue?: string;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState(searchValue);

    useEffect(() => setSearchTerm(searchValue), [searchValue]);

    useEffect(() => {
        document.body.style.overflow = isMenuOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isMenuOpen]);

    useEffect(() => setIsMenuOpen(false), [pathname]);

    const handleSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        onSearch?.(searchTerm);
        if (pathname === '/' || pathname === '/channels') {
            const params = new URLSearchParams(window.location.search);
            searchTerm ? params.set('search', searchTerm) : params.delete('search');
            router.push(`${pathname}?${params.toString()}`, { scroll: false });
        }
    }, [onSearch, searchTerm, pathname, router]);

    return (
        <>
            {/* ========== MAIN HEADER ========== */}
            <header
                className="fixed top-0 left-0 right-0 z-50 transition-colors duration-300"
                style={{
                    backgroundColor: 'var(--neu-bg-page)',
                    borderBottom: '1px solid var(--border-primary)',
                    boxShadow: '0 1px 3px var(--shadow-color)',
                }}
            >
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between h-16">

                        {/* ========== LOGO ========== */}
                        <Link href="/" className="flex items-center gap-3 group">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300"
                                style={{
                                    backgroundColor: 'var(--neu-bg)',
                                    boxShadow: '4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light)',
                                }}
                            >
                                <GiSoccerBall className="w-6 h-6 text-red-600 group-hover:scale-110 transition-transform" />
                            </div>
                            <span className="text-2xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                                BraveStream
                            </span>
                        </Link>

                        {/* ========== DESKTOP NAV ========== */}
                        <nav className="hidden lg:flex items-center gap-1">
                            {NAV_LINKS.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                                        pathname === link.href
                                            ? 'text-red-600 font-semibold'
                                            : ''
                                    }`}
                                    style={{
                                        color: pathname === link.href
                                            ? 'var(--brand-red)'
                                            : 'var(--text-muted)',
                                        backgroundColor: pathname === link.href
                                            ? 'var(--error-bg)'
                                            : 'transparent',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (pathname !== link.href) {
                                            e.currentTarget.style.color = 'var(--brand-red)';
                                            e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (pathname !== link.href) {
                                            e.currentTarget.style.color = 'var(--text-muted)';
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                        }
                                    }}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>

                        {/* ========== RIGHT SIDE ACTIONS ========== */}
                        <div className="flex items-center gap-3">

                            {/* Search Bar (Desktop) */}
                            <form onSubmit={handleSearch} className="hidden lg:block relative">
                                <input
                                    type="text"
                                    placeholder="Search matches..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-52 focus:w-64 pl-4 pr-10 py-2 rounded-full text-sm border-none transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                                    style={{
                                        backgroundColor: 'var(--neu-bg)',
                                        color: 'var(--text-primary)',
                                        boxShadow: 'inset 4px 4px 8px var(--neu-shadow-dark), inset -4px -4px 8px var(--neu-shadow-light)',
                                    }}
                                />
                                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <FaSearch
                                        className="w-4 h-4 transition-colors"
                                        style={{ color: 'var(--text-muted)' }}
                                    />
                                </button>
                            </form>

                            {/* LIVE Badge */}
                            <Link
                                href="/"
                                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                                style={{
                                    backgroundColor: 'var(--error-bg)',
                                    border: '1px solid var(--brand-red)',
                                    color: 'var(--brand-red)',
                                }}
                            >
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                LIVE
                            </Link>

                            {/* Mobile Menu Toggle */}
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="lg:hidden p-2.5 rounded-xl transition-colors duration-300"
                                style={{
                                    backgroundColor: 'var(--neu-bg)',
                                    boxShadow: '4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light)',
                                }}
                                aria-label="Toggle menu"
                            >
                                {isMenuOpen
                                    ? <FaTimes className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                                    : <FaBars className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                                }
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* ========== MOBILE MENU ========== */}
            {isMenuOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 backdrop-blur-sm"
                        style={{ backgroundColor: 'var(--overlay-medium)' }}
                        onClick={() => setIsMenuOpen(false)}
                    />

                    {/* Menu Panel */}
                    <div
                        className="absolute top-0 right-0 h-full w-72 shadow-xl transition-colors duration-300"
                        style={{ backgroundColor: 'var(--neu-bg-page)' }}
                    >
                        <div className="p-5 h-full overflow-y-auto">

                            {/* Menu Header */}
                            <div className="flex items-center justify-between mb-6">
                                <span
                                    className="text-lg font-bold"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    Menu
                                </span>
                                <button
                                    onClick={() => setIsMenuOpen(false)}
                                    className="p-2 rounded-xl transition-colors duration-300"
                                    style={{
                                        backgroundColor: 'var(--neu-bg)',
                                        boxShadow: '4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light)',
                                    }}
                                >
                                    <FaTimes className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                                </button>
                            </div>

                            {/* Mobile Search */}
                            <form
                                onSubmit={(e) => { handleSearch(e); setIsMenuOpen(false); }}
                                className="mb-6 relative"
                            >
                                <input
                                    type="text"
                                    placeholder="Search matches..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-4 pr-10 py-2.5 rounded-full text-sm border-none focus:outline-none focus:ring-2 focus:ring-red-500/30"
                                    style={{
                                        backgroundColor: 'var(--neu-bg)',
                                        color: 'var(--text-primary)',
                                        boxShadow: 'inset 4px 4px 8px var(--neu-shadow-dark), inset -4px -4px 8px var(--neu-shadow-light)',
                                    }}
                                />
                                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <FaSearch className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                </button>
                            </form>

                            {/* Mobile Nav Links */}
                            <div className="space-y-2">
                                {NAV_LINKS.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setIsMenuOpen(false)}
                                        className="block px-4 py-3 rounded-xl text-sm font-medium transition-all"
                                        style={{
                                            color: pathname === link.href
                                                ? 'var(--brand-red)'
                                                : 'var(--text-secondary)',
                                            backgroundColor: pathname === link.href
                                                ? 'var(--error-bg)'
                                                : 'var(--neu-bg)',
                                            boxShadow: pathname !== link.href
                                                ? '4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light)'
                                                : 'none',
                                            fontWeight: pathname === link.href ? '600' : '500',
                                        }}
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                            </div>

                            {/* Mobile LIVE Badge */}
                            <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border-secondary)' }}>
                                <Link
                                    href="/"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                                    style={{
                                        backgroundColor: 'var(--error-bg)',
                                        color: 'var(--brand-red)',
                                        border: '1px solid var(--brand-red)',
                                    }}
                                >
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                    Watch LIVE Now
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Spacer for fixed header */}
            <div className="h-16" aria-hidden="true" />
        </>
    );
}