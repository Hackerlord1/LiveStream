'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FaBars, FaTimes, FaSearch } from 'react-icons/fa';
import { GiSoccerBall, GiTvRemote } from 'react-icons/gi';
import { MdLiveTv } from 'react-icons/md';

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
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#e8e8e8] border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        <Link href="/" className="flex items-center gap-3 group">
                            <div
                                className="w-10 h-10 rounded-xl bg-[#e0e0e0] flex items-center justify-center"
                                style={{ boxShadow: '4px 4px 8px #bebebe, -4px -4px 8px #ffffff' }}
                            >
                                <GiSoccerBall className="w-6 h-6 text-red-600 group-hover:scale-110 transition-transform" />
                            </div>
                            <span className="text-2xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                                BraveStream
                            </span>
                        </Link>

                        <nav className="hidden lg:flex items-center gap-1">
                            {NAV_LINKS.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        pathname === link.href
                                            ? 'text-red-600 bg-red-50 font-semibold'
                                            : 'text-gray-600 hover:text-red-600 hover:bg-gray-100'
                                    }`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>

                        <div className="flex items-center gap-3">
                            <form onSubmit={handleSearch} className="hidden lg:block relative">
                                <input
                                    type="text"
                                    placeholder="Search matches..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-52 focus:w-64 pl-4 pr-10 py-2 rounded-full text-sm text-gray-700 bg-[#e0e0e0] border-none transition-all duration-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                                    style={{ boxShadow: 'inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff' }}
                                />
                                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <FaSearch className="w-4 h-4 text-gray-400 hover:text-red-500 transition-colors" />
                                </button>
                            </form>

                            <Link
                                href="/"
                                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors"
                            >
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                LIVE
                            </Link>

                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="lg:hidden p-2.5 rounded-xl bg-[#e0e0e0]"
                                style={{ boxShadow: '4px 4px 8px #bebebe, -4px -4px 8px #ffffff' }}
                                aria-label="Toggle menu"
                            >
                                {isMenuOpen
                                    ? <FaTimes className="w-5 h-5 text-gray-700" />
                                    : <FaBars className="w-5 h-5 text-gray-700" />
                                }
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {isMenuOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setIsMenuOpen(false)}
                    />
                    <div className="absolute top-0 right-0 h-full w-72 bg-[#e8e8e8] shadow-xl">
                        <div className="p-5 h-full overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <span className="text-lg font-bold text-gray-900">Menu</span>
                                <button
                                    onClick={() => setIsMenuOpen(false)}
                                    className="p-2 rounded-xl bg-[#e0e0e0]"
                                    style={{ boxShadow: '4px 4px 8px #bebebe, -4px -4px 8px #ffffff' }}
                                >
                                    <FaTimes className="w-5 h-5 text-gray-700" />
                                </button>
                            </div>

                            <form
                                onSubmit={(e) => { handleSearch(e); setIsMenuOpen(false); }}
                                className="mb-6 relative"
                            >
                                <input
                                    type="text"
                                    placeholder="Search matches..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-4 pr-10 py-2.5 rounded-full text-sm text-gray-700 bg-[#e0e0e0] border-none placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                                    style={{ boxShadow: 'inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff' }}
                                />
                                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <FaSearch className="w-4 h-4 text-gray-400" />
                                </button>
                            </form>

                            <div className="space-y-2">
                                {NAV_LINKS.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setIsMenuOpen(false)}
                                        className={`block px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                            pathname === link.href
                                                ? 'text-red-600 bg-red-50 font-semibold'
                                                : 'text-gray-700 bg-[#e0e0e0]'
                                        }`}
                                        style={pathname !== link.href
                                            ? { boxShadow: '4px 4px 8px #bebebe, -4px -4px 8px #ffffff' }
                                            : undefined
                                        }
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="h-16" aria-hidden="true" />
        </>
    );
}