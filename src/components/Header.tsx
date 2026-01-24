// src/components/Header.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    FaTwitter,
    FaFacebook,
    FaInstagram,
    FaYoutube,
    FaTelegram,
    FaBars,
    FaTimes,
    FaSearch,
    FaUser,
    FaHeart,
    FaCog,
    FaChevronDown
} from 'react-icons/fa';
import { GiSoccerBall, GiTvRemote } from 'react-icons/gi';
import { MdLiveTv } from 'react-icons/md';
import { FaCalendarAlt } from 'react-icons/fa';

interface HeaderProps {
    onSearch?: (term: string) => void;
    searchValue?: string;
    onFilterChange?: (sport: string) => void;
}

export default function Header({ onSearch, searchValue = '', onFilterChange }: HeaderProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState(searchValue);
    const [selectedSport, setSelectedSport] = useState<string>('all');

    // Update local search term when prop changes
    useEffect(() => {
        setSearchTerm(searchValue);
    }, [searchValue]);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.user-menu') && !target.closest('.user-menu-button')) {
                setIsUserMenuOpen(false);
            }
            if (!target.closest('.mobile-menu') && !target.closest('.menu-button')) {
                setIsMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
    }, [isMenuOpen]);

    const handleSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (onSearch) {
            onSearch(searchTerm);
        }
        // Also update URL for shareable search
        if (pathname === '/' || pathname === '/channels') {
            const params = new URLSearchParams(window.location.search);
            if (searchTerm) {
                params.set('search', searchTerm);
            } else {
                params.delete('search');
            }
            router.push(`${pathname}?${params.toString()}`, { scroll: false });
        }
    }, [onSearch, searchTerm, pathname, router]);

    const handleSportChange = useCallback((sport: string) => {
        setSelectedSport(sport);
        if (onFilterChange) {
            onFilterChange(sport);
        }
        // Update URL for shareable filter
        if (pathname === '/') {
            const params = new URLSearchParams(window.location.search);
            if (sport === 'all') {
                params.delete('sport');
            } else {
                params.set('sport', sport);
            }
            router.push(`/?${params.toString()}`, { scroll: false });
        }
    }, [onFilterChange, pathname, router]);

    // Quick links for secondary navigation bar
    const quickLinks = [
        {
            id: 'live',
            href: '/',
            label: 'Live Matches',
            icon: MdLiveTv,
            color: 'text-red-500',
            badge: 'LIVE'
        },

        {
            id: 'channels',
            href: '/channels',
            label: 'Channels',
            icon: GiTvRemote,
            color: 'text-purple-500',
            isSpecial: true,
            badge: 'HOT'
        },
    ];

    // Main navigation links
    const navLinks = [
        { id: 'home', href: '/', label: 'Home' },
        { id: 'about', href: '/about', label: 'About Us' },
        { id: 'contact', href: '/contact', label: 'Contact Us' },
        { id: 'dmca', href: '/dmca', label: 'DMCA' },
    ];

    // Social links with brand colors
    const socialLinks = [
        {
            href: 'https://twitter.com',
            icon: FaTwitter,
            label: 'Twitter',
            color: 'text-[#1DA1F2] hover:bg-[#1DA1F2]/10',
            bgColor: '#1DA1F2'
        },
        {
            href: 'https://facebook.com',
            icon: FaFacebook,
            label: 'Facebook',
            color: 'text-[#1877F2] hover:bg-[#1877F2]/10',
            bgColor: '#1877F2'
        },
        {
            href: 'https://instagram.com',
            icon: FaInstagram,
            label: 'Instagram',
            color: 'text-[#E4405F] hover:bg-[#E4405F]/10',
            bgColor: '#E4405F'
        },
        {
            href: 'https://youtube.com',
            icon: FaYoutube,
            label: 'YouTube',
            color: 'text-[#FF0000] hover:bg-[#FF0000]/10',
            bgColor: '#FF0000'
        },
        {
            href: 'https://telegram.org',
            icon: FaTelegram,
            label: 'Telegram',
            color: 'text-[#26A5E4] hover:bg-[#26A5E4]/10',
            bgColor: '#26A5E4'
        },
    ];

    return (
        <>
            {/* Main Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#e8e8e8] py-4 border-b border-gray-200 shadow-lg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <Link href="/" className="flex items-center space-x-3 group">
                            <div className="neumorphic-logo w-12 h-12">
                                <GiSoccerBall className="w-full h-full text-red-600 transform group-hover:scale-110 transition-transform duration-300" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-3xl font-bold">
                                    <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                                        BraveStream
                                    </span>
                                </span>
                                <span className="text-xs text-gray-600 hidden sm:block">Live Sports Streaming</span>
                            </div>
                        </Link>

                        {/* Main Navigation Links - Desktop */}
                        <div className="hidden lg:flex items-center space-x-2">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.id}
                                    href={link.href}
                                    className={`nav-link ${pathname === link.href ? 'active' : ''}`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>

                        {/* Right Side Actions */}
                        <div className="flex items-center space-x-3">
                            {/* Search Bar - Desktop */}
                            <div className="hidden lg:flex items-center">
                                <form onSubmit={handleSearch} className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search matches..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="neumorphic-search"
                                        aria-label="Search matches"
                                    />
                                    <button
                                        type="submit"
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2"
                                        aria-label="Submit search"
                                    >
                                        <FaSearch className="text-gray-500 hover:text-red-500 transition-colors" />
                                    </button>
                                </form>
                            </div>

                            {/* User Menu */}
                            <div className="hidden lg:block relative user-menu">
                                <button
                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                    className="neumorphic-user-button user-menu-button"
                                    aria-label="User menu"
                                    aria-expanded={isUserMenuOpen}
                                >
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-red-600 to-red-800 flex items-center justify-center">
                                        <FaUser className="w-4 h-4 text-white" />
                                    </div>
                                </button>

                                {/* User Dropdown Menu */}
                                {isUserMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 neumorphic-dropdown">
                                        <div className="py-2">
                                            <div className="px-4 py-3 border-b border-gray-300">
                                                <p className="text-sm font-semibold text-gray-900">Welcome!</p>
                                                <p className="text-xs text-gray-600">Sign in for more features</p>
                                            </div>

                                            <Link
                                                href="/signin"
                                                className="dropdown-item"
                                                onClick={() => setIsUserMenuOpen(false)}
                                            >
                                                <FaUser className="w-4 h-4" />
                                                <span>Sign In</span>
                                            </Link>

                                            <Link
                                                href="/favorites"
                                                className="dropdown-item"
                                                onClick={() => setIsUserMenuOpen(false)}
                                            >
                                                <FaHeart className="w-4 h-4" />
                                                <span>Favorites</span>
                                            </Link>

                                            <Link
                                                href="/settings"
                                                className="dropdown-item"
                                                onClick={() => setIsUserMenuOpen(false)}
                                            >
                                                <FaCog className="w-4 h-4" />
                                                <span>Settings</span>
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Mobile Menu Button */}
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="lg:hidden neumorphic-button p-2 menu-button"
                                aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                                aria-expanded={isMenuOpen}
                            >
                                {isMenuOpen ? (
                                    <FaTimes className="w-6 h-6 text-gray-700" />
                                ) : (
                                    <FaBars className="w-6 h-6 text-gray-700" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Secondary Navigation Bar */}
                <div className="secondary-nav-bar">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between">
                            {/* Quick Links - LEFT SIDE */}
                            <div className="flex items-center space-x-4">
                                {quickLinks.map((link) => (
                                    <Link
                                        key={link.id}
                                        href={link.href}
                                        className={`secondary-nav-link ${link.isSpecial ? 'special-channel' : ''} ${
                                            pathname === link.href ? 'active' : ''
                                        }`}
                                    >
                                        <link.icon className={`w-5 h-5 ${link.color}`} />
                                        <span className="font-medium">{link.label}</span>
                                        {link.badge && (
                                            <span className={`badge ${link.id === 'live' ? 'live-badge' : 'hot-badge'}`}>
                                                {link.badge}
                                            </span>
                                        )}
                                    </Link>
                                ))}
                            </div>

                            {/* Social Media Icons - RIGHT SIDE */}
                            <div className="hidden lg:flex items-center space-x-3">
                                <span className="text-sm text-gray-600 mr-2">Follow us:</span>
                                <div className="flex items-center space-x-2">
                                    {socialLinks.map((social) => (
                                        <a
                                            key={social.label}
                                            href={social.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`social-icon-button ${social.color}`}
                                            aria-label={`Follow us on ${social.label}`}
                                            style={{ '--social-color': social.bgColor } as React.CSSProperties}
                                        >
                                            <social.icon className="text-lg" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu Overlay */}
                {isMenuOpen && (
                    <div className="lg:hidden mobile-menu">
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={() => setIsMenuOpen(false)}
                        />

                        {/* Menu Panel */}
                        <div className="fixed top-0 right-0 h-full w-80 bg-[#e8e8e8] shadow-xl">
                            <div className="p-6 h-full overflow-y-auto">
                                {/* Menu Header */}
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center space-x-2">
                                        <div className="neumorphic-logo w-10 h-10">
                                            <GiSoccerBall className="w-full h-full text-red-600" />
                                        </div>
                                        <span className="text-xl font-bold text-gray-900">Menu</span>
                                    </div>
                                    <button
                                        onClick={() => setIsMenuOpen(false)}
                                        className="neumorphic-button p-2"
                                        aria-label="Close menu"
                                    >
                                        <FaTimes className="w-5 h-5 text-gray-700" />
                                    </button>
                                </div>

                                {/* Search in Mobile Menu */}
                                <div className="mb-6">
                                    <form onSubmit={handleSearch}>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search matches..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full neumorphic-search"
                                                aria-label="Search matches"
                                            />
                                            <button
                                                type="submit"
                                                className="absolute right-3 top-1/2 transform -translate-y-1/2"
                                                aria-label="Submit search"
                                            >
                                                <FaSearch className="text-gray-500 hover:text-red-500 transition-colors" />
                                            </button>
                                        </div>
                                    </form>
                                </div>

                                {/* Main Navigation Links in Mobile */}
                                <div className="space-y-3 mb-8">
                                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                        Main Navigation
                                    </h3>
                                    {navLinks.map((link) => (
                                        <Link
                                            key={link.id}
                                            href={link.href}
                                            className={`mobile-nav-link ${pathname === link.href ? 'active' : ''}`}
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            {link.label}
                                        </Link>
                                    ))}
                                </div>

                                {/* Quick Links in Mobile */}
                                <div className="space-y-3 mb-8">
                                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                        Quick Links
                                    </h3>
                                    {quickLinks.map((link) => (
                                        <Link
                                            key={link.id}
                                            href={link.href}
                                            className={`secondary-mobile-link ${link.isSpecial ? 'special-channel-mobile' : ''} ${
                                                pathname === link.href ? 'active' : ''
                                            }`}
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            <div className="flex items-center space-x-3">
                                                <link.icon className={`w-5 h-5 ${link.color}`} />
                                                <span>{link.label}</span>
                                            </div>
                                            {link.badge && (
                                                <span className={`badge ${link.id === 'live' ? 'live-badge' : 'hot-badge'}`}>
                                                    {link.badge}
                                                </span>
                                            )}
                                        </Link>
                                    ))}
                                </div>

                                {/* Social Links in Mobile */}
                                <div className="mb-8">
                                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                        Follow Us
                                    </h3>
                                    <div className="flex justify-center space-x-3">
                                        {socialLinks.map((social) => (
                                            <a
                                                key={social.label}
                                                href={social.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`social-icon-button ${social.color}`}
                                                aria-label={`Follow us on ${social.label}`}
                                                style={{ '--social-color': social.bgColor } as React.CSSProperties}
                                            >
                                                <social.icon className="text-lg" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Spacer to prevent content from going under fixed header */}
            <div className="h-48" />

            {/* Header Styles */}
            <style jsx global>{`
                /* Neumorphic Logo */
                .neumorphic-logo {
                    background: #e0e0e0;
                    border-radius: 12px;
                    padding: 8px;
                    box-shadow: 4px 4px 8px #bebebe,
                    -4px -4px 8px #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                }

                /* Neumorphic Search */
                .neumorphic-search {
                    width: 200px;
                    padding: 10px 40px 10px 16px;
                    border-radius: 25px;
                    background: #e0e0e0;
                    border: none;
                    color: #374151;
                    font-size: 14px;
                    box-shadow: inset 4px 4px 8px #bebebe,
                    inset -4px -4px 8px #ffffff;
                    transition: all 0.3s ease;
                }

                .neumorphic-search:focus {
                    outline: none;
                    box-shadow: inset 6px 6px 12px #bebebe,
                    inset -6px -6px 12px #ffffff;
                    width: 240px;
                }

                /* Neumorphic Buttons */
                .neumorphic-button {
                    border-radius: 12px;
                    background: #e0e0e0;
                    border: none;
                    color: #4b5563;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 4px 4px 8px #bebebe,
                    -4px -4px 8px #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .neumorphic-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 6px 6px 12px #bebebe,
                    -6px -6px 12px #ffffff;
                }

                .neumorphic-button:active {
                    box-shadow: inset 3px 3px 6px #bebebe,
                    inset -3px -3px 6px #ffffff;
                }

                /* Main Navigation Links */
                .nav-link {
                    padding: 8px 16px;
                    color: #4b5563;
                    font-weight: 500;
                    text-decoration: none;
                    border-radius: 8px;
                    transition: all 0.2s ease;
                }

                .nav-link:hover {
                    color: #dc2626;
                    background: rgba(0, 0, 0, 0.05);
                }

                .nav-link.active {
                    color: #dc2626;
                    font-weight: 600;
                    background: rgba(220, 38, 38, 0.1);
                }

                /* Secondary Navigation Bar */
                .secondary-nav-bar {
                    background: #f0f0f0;
                    border-top: 1px solid #ddd;
                    border-bottom: 1px solid #ddd;
                    padding: 10px 0;
                }

                /* Secondary Navigation Links */
                .secondary-nav-link {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    border-radius: 10px;
                    background: #e8e8e8;
                    color: #4b5563;
                    font-weight: 500;
                    text-decoration: none;
                    transition: all 0.3s ease;
                    box-shadow: 2px 2px 4px #bebebe,
                    -2px -2px 4px #ffffff;
                }

                .secondary-nav-link:hover {
                    transform: translateY(-2px);
                    box-shadow: 4px 4px 8px #bebebe,
                    -4px -4px 8px #ffffff;
                    color: #dc2626;
                }

                .secondary-nav-link.active {
                    color: #dc2626;
                    background: rgba(220, 38, 38, 0.1);
                    font-weight: 600;
                }

                .special-channel {
                    position: relative;
                    overflow: hidden;
                }

                .special-channel::before {
                    content: '';
                    position: absolute;
                    top: -2px;
                    right: -2px;
                    bottom: -2px;
                    left: -2px;
                    border-radius: 12px;
                    background: linear-gradient(45deg, #8b5cf6, #ec4899);
                    z-index: -1;
                    opacity: 0.3;
                }

                .special-channel:hover::before {
                    opacity: 0.5;
                }

                /* Badges */
                .badge {
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 10px;
                    font-weight: bold;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .live-badge {
                    background: linear-gradient(45deg, #ef4444, #dc2626);
                    color: white;
                    animation: pulse 2s infinite;
                }

                .hot-badge {
                    background: linear-gradient(45deg, #8b5cf6, #ec4899);
                    color: white;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }

                /* Social Icon Buttons */
                .social-icon-button {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    background: #e8e8e8;
                    border: none;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 2px 2px 4px #bebebe,
                    -2px -2px 4px #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .social-icon-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 4px 4px 8px #bebebe,
                    -4px -4px 8px #ffffff;
                    background-color: var(--social-color, #e8e8e8);
                    color: white !important;
                }

                /* User Menu Button */
                .neumorphic-user-button {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border-radius: 20px;
                    background: #e0e0e0;
                    border: none;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 4px 4px 8px #bebebe,
                    -4px -4px 8px #ffffff;
                }

                .neumorphic-user-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 6px 6px 12px #bebebe,
                    -6px -6px 12px #ffffff;
                }

                /* Dropdown Menu */
                .neumorphic-dropdown {
                    background: #e8e8e8;
                    border-radius: 12px;
                    box-shadow: 8px 8px 16px #bebebe,
                    -8px -8px 16px #ffffff,
                    0 10px 30px rgba(0, 0, 0, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    overflow: hidden;
                    z-index: 1000;
                }

                .dropdown-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 16px;
                    color: #4b5563;
                    font-size: 14px;
                    text-decoration: none;
                    transition: all 0.2s ease;
                }

                .dropdown-item:hover {
                    background: rgba(0, 0, 0, 0.05);
                    color: #dc2626;
                }

                /* Mobile Navigation Links */
                .mobile-nav-link {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    border-radius: 12px;
                    background: #e0e0e0;
                    color: #4b5563;
                    font-weight: 500;
                    text-decoration: none;
                    margin-bottom: 8px;
                    box-shadow: 4px 4px 8px #bebebe,
                    -4px -4px 8px #ffffff;
                    transition: all 0.3s ease;
                }

                .mobile-nav-link:hover {
                    color: #dc2626;
                    transform: translateX(4px);
                }

                .mobile-nav-link.active {
                    color: #dc2626;
                    font-weight: 600;
                    background: rgba(220, 38, 38, 0.1);
                }

                /* Secondary Mobile Links */
                .secondary-mobile-link {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    border-radius: 12px;
                    background: #e0e0e0;
                    color: #4b5563;
                    font-weight: 500;
                    text-decoration: none;
                    margin-bottom: 8px;
                    box-shadow: 4px 4px 8px #bebebe,
                    -4px -4px 8px #ffffff;
                    transition: all 0.3s ease;
                }

                .secondary-mobile-link:hover {
                    color: #dc2626;
                    transform: translateX(4px);
                }

                .secondary-mobile-link.active {
                    color: #dc2626;
                    background: rgba(220, 38, 38, 0.1);
                    font-weight: 600;
                }

                .special-channel-mobile {
                    position: relative;
                    overflow: hidden;
                }

                .special-channel-mobile::before {
                    content: '';
                    position: absolute;
                    top: -2px;
                    right: -2px;
                    bottom: -2px;
                    left: -2px;
                    border-radius: 12px;
                    background: linear-gradient(45deg, #8b5cf6, #ec4899);
                    z-index: -1;
                    opacity: 0.3;
                }

                /* Mobile Menu Animations */
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                    }
                    to {
                        transform: translateX(0);
                    }
                }

                .mobile-menu > div:last-child {
                    animation: slideIn 0.3s ease-out;
                }

                /* Focus styles for accessibility */
                .neumorphic-search:focus,
                .neumorphic-button:focus,
                .nav-link:focus,
                .secondary-nav-link:focus {
                    outline: 2px solid #dc2626;
                    outline-offset: 2px;
                }
            `}</style>
        </>
    );
}