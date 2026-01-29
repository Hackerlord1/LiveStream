// src/components/Header.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

// Icons
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
} from 'react-icons/fa';
import { GiSoccerBall, GiTvRemote } from 'react-icons/gi';
import { MdLiveTv } from 'react-icons/md';

// ========== TYPES ==========
interface HeaderProps {
    onSearch?: (term: string) => void;
    searchValue?: string;
    onFilterChange?: (sport: string) => void;
}

interface NavLink {
    id: string;
    href: string;
    label: string;
}

interface QuickLink {
    id: string;
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    badge?: string;
    isSpecial?: boolean;
}

interface SocialLink {
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    color: string;
    bgColor: string;
}

// ========== CONSTANTS ==========
const NAV_LINKS: NavLink[] = [
    { id: 'home', href: '/', label: 'Home' },
    { id: 'about', href: '/about', label: 'About Us' },
    { id: 'contact', href: '/contact', label: 'Contact Us' },
    { id: 'dmca', href: '/dmca', label: 'DMCA' },
];

const QUICK_LINKS: QuickLink[] = [
    {
        id: 'live',
        href: '/',
        label: 'Live Matches',
        icon: MdLiveTv,
        color: 'text-red-500',
        badge: 'LIVE',
    },
    {
        id: 'channels',
        href: '/channels',
        label: 'Channels',
        icon: GiTvRemote,
        color: 'text-purple-500',
        badge: 'HOT',
        isSpecial: true,
    },
];

const SOCIAL_LINKS: SocialLink[] = [
    {
        href: 'https://twitter.com',
        icon: FaTwitter,
        label: 'Twitter',
        color: 'text-[#1DA1F2] hover:bg-[#1DA1F2]/10',
        bgColor: '#1DA1F2',
    },
    {
        href: 'https://facebook.com',
        icon: FaFacebook,
        label: 'Facebook',
        color: 'text-[#1877F2] hover:bg-[#1877F2]/10',
        bgColor: '#1877F2',
    },
    {
        href: 'https://instagram.com',
        icon: FaInstagram,
        label: 'Instagram',
        color: 'text-[#E4405F] hover:bg-[#E4405F]/10',
        bgColor: '#E4405F',
    },
    {
        href: 'https://youtube.com',
        icon: FaYoutube,
        label: 'YouTube',
        color: 'text-[#FF0000] hover:bg-[#FF0000]/10',
        bgColor: '#FF0000',
    },
    {
        href: 'https://telegram.org',
        icon: FaTelegram,
        label: 'Telegram',
        color: 'text-[#26A5E4] hover:bg-[#26A5E4]/10',
        bgColor: '#26A5E4',
    },
];

// ========== SUB-COMPONENTS ==========

// Logo Component
const Logo = () => (
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
            <span className="text-xs text-gray-600 hidden sm:block">
                Live Sports Streaming
            </span>
        </div>
    </Link>
);

// Search Form Component
interface SearchFormProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    className?: string;
}

const SearchForm = ({ value, onChange, onSubmit, className = '' }: SearchFormProps) => (
    <form onSubmit={onSubmit} className={`relative ${className}`}>
        <input
            type="text"
            placeholder="Search matches..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
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
);

// User Menu Component
interface UserMenuProps {
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
}

const UserMenu = ({ isOpen, onToggle, onClose }: UserMenuProps) => (
    <div className="relative user-menu">
        <button
            onClick={onToggle}
            className="neumorphic-user-button user-menu-button"
            aria-label="User menu"
            aria-expanded={isOpen}
        >
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-red-600 to-red-800 flex items-center justify-center">
                <FaUser className="w-4 h-4 text-white" />
            </div>
        </button>

        {isOpen && (
            <div className="absolute right-0 mt-2 w-48 neumorphic-dropdown">
                <div className="py-2">
                    <div className="px-4 py-3 border-b border-gray-300">
                        <p className="text-sm font-semibold text-gray-900">Welcome!</p>
                        <p className="text-xs text-gray-600">Sign in for more features</p>
                    </div>

                    <Link href="/signin" className="dropdown-item" onClick={onClose}>
                        <FaUser className="w-4 h-4" />
                        <span>Sign In</span>
                    </Link>

                    <Link href="/favorites" className="dropdown-item" onClick={onClose}>
                        <FaHeart className="w-4 h-4" />
                        <span>Favorites</span>
                    </Link>

                    <Link href="/settings" className="dropdown-item" onClick={onClose}>
                        <FaCog className="w-4 h-4" />
                        <span>Settings</span>
                    </Link>
                </div>
            </div>
        )}
    </div>
);

// Badge Component
interface BadgeProps {
    type: 'live' | 'hot';
    children: React.ReactNode;
}

const Badge = ({ type, children }: BadgeProps) => (
    <span className={`badge ${type === 'live' ? 'live-badge' : 'hot-badge'}`}>
        {children}
    </span>
);

// Social Icons Component
const SocialIcons = ({ links, className = '' }: { links: SocialLink[]; className?: string }) => (
    <div className={`flex items-center space-x-2 ${className}`}>
        {links.map((social) => (
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
);

// Mobile Menu Component
interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    pathname: string;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onSearchSubmit: (e: React.FormEvent) => void;
}

const MobileMenu = ({
    isOpen,
    onClose,
    pathname,
    searchTerm,
    onSearchChange,
    onSearchSubmit,
}: MobileMenuProps) => {
    if (!isOpen) return null;

    return (
        <div className="lg:hidden mobile-menu">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Menu Panel */}
            <div className="fixed top-0 right-0 h-full w-80 bg-[#e8e8e8] shadow-xl z-50">
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
                            onClick={onClose}
                            className="neumorphic-button p-2"
                            aria-label="Close menu"
                        >
                            <FaTimes className="w-5 h-5 text-gray-700" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="mb-6">
                        <SearchForm
                            value={searchTerm}
                            onChange={onSearchChange}
                            onSubmit={(e) => {
                                onSearchSubmit(e);
                                onClose();
                            }}
                            className="w-full"
                        />
                    </div>

                    {/* Main Navigation */}
                    <div className="space-y-3 mb-8">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Main Navigation
                        </h3>
                        {NAV_LINKS.map((link) => (
                            <Link
                                key={link.id}
                                href={link.href}
                                className={`mobile-nav-link ${pathname === link.href ? 'active' : ''}`}
                                onClick={onClose}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    {/* Quick Links */}
                    <div className="space-y-3 mb-8">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Quick Links
                        </h3>
                        {QUICK_LINKS.map((link) => (
                            <Link
                                key={link.id}
                                href={link.href}
                                className={`secondary-mobile-link ${link.isSpecial ? 'special-channel-mobile' : ''} ${
                                    pathname === link.href ? 'active' : ''
                                }`}
                                onClick={onClose}
                            >
                                <div className="flex items-center space-x-3">
                                    <link.icon className={`w-5 h-5 ${link.color}`} />
                                    <span>{link.label}</span>
                                </div>
                                {link.badge && (
                                    <Badge type={link.id === 'live' ? 'live' : 'hot'}>
                                        {link.badge}
                                    </Badge>
                                )}
                            </Link>
                        ))}
                    </div>

                    {/* Social Links */}
                    <div className="mb-8">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Follow Us
                        </h3>
                        <SocialIcons links={SOCIAL_LINKS} className="justify-center" />
                    </div>
                </div>
            </div>
        </div>
    );
};

// ========== MAIN COMPONENT ==========
export default function Header({ onSearch, searchValue = '', onFilterChange }: HeaderProps) {
    const pathname = usePathname();
    const router = useRouter();

    // State
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState(searchValue);

    // Sync search term with prop
    useEffect(() => {
        setSearchTerm(searchValue);
    }, [searchValue]);

    // Close menus on outside click
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
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        document.body.style.overflow = isMenuOpen ? 'hidden' : 'unset';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isMenuOpen]);

    // Handle search submit
    const handleSearch = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();

            if (onSearch) {
                onSearch(searchTerm);
            }

            // Update URL for shareable search
            if (typeof window !== 'undefined' && (pathname === '/' || pathname === '/channels')) {
                const params = new URLSearchParams(window.location.search);
                if (searchTerm) {
                    params.set('search', searchTerm);
                } else {
                    params.delete('search');
                }
                router.push(`${pathname}?${params.toString()}`, { scroll: false });
            }
        },
        [onSearch, searchTerm, pathname, router]
    );

    // Close handlers
    const closeUserMenu = useCallback(() => setIsUserMenuOpen(false), []);
    const closeMobileMenu = useCallback(() => setIsMenuOpen(false), []);

    return (
        <>
            {/* Main Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#e8e8e8] py-4 border-b border-gray-200 shadow-lg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <Logo />

                        {/* Desktop Navigation */}
                        <nav className="hidden lg:flex items-center space-x-2">
                            {NAV_LINKS.map((link) => (
                                <Link
                                    key={link.id}
                                    href={link.href}
                                    className={`nav-link ${pathname === link.href ? 'active' : ''}`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>

                        {/* Right Side Actions */}
                        <div className="flex items-center space-x-3">
                            {/* Desktop Search */}
                            <div className="hidden lg:block">
                                <SearchForm
                                    value={searchTerm}
                                    onChange={setSearchTerm}
                                    onSubmit={handleSearch}
                                />
                            </div>

                            {/* User Menu - Desktop */}
                            <div className="hidden lg:block">
                                <UserMenu
                                    isOpen={isUserMenuOpen}
                                    onToggle={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                    onClose={closeUserMenu}
                                />
                            </div>

                            {/* Mobile Menu Button */}
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="lg:hidden neumorphic-button p-2 menu-button"
                                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
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
                            {/* Quick Links */}
                            <div className="flex items-center space-x-4">
                                {QUICK_LINKS.map((link) => (
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
                                            <Badge type={link.id === 'live' ? 'live' : 'hot'}>
                                                {link.badge}
                                            </Badge>
                                        )}
                                    </Link>
                                ))}
                            </div>

                            {/* Social Icons - Desktop */}
                            <div className="hidden lg:flex items-center space-x-3">
                                <span className="text-sm text-gray-600 mr-2">Follow us:</span>
                                <SocialIcons links={SOCIAL_LINKS} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                <MobileMenu
                    isOpen={isMenuOpen}
                    onClose={closeMobileMenu}
                    pathname={pathname}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onSearchSubmit={handleSearch}
                />
            </header>

            {/* Spacer for fixed header */}
            <div className="h-32 sm:h-36 lg:h-40" aria-hidden="true" />

            {/* Styles */}
            <style jsx global>{`
                /* Neumorphic Logo */
                .neumorphic-logo {
                    background: #e0e0e0;
                    border-radius: 12px;
                    padding: 8px;
                    box-shadow: 4px 4px 8px #bebebe, -4px -4px 8px #ffffff;
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
                    box-shadow: inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff;
                    transition: all 0.3s ease;
                }

                .neumorphic-search:focus {
                    outline: none;
                    box-shadow: inset 6px 6px 12px #bebebe, inset -6px -6px 12px #ffffff;
                    width: 240px;
                }

                .neumorphic-search::placeholder {
                    color: #9ca3af;
                }

                /* Neumorphic Buttons */
                .neumorphic-button {
                    border-radius: 12px;
                    background: #e0e0e0;
                    border: none;
                    color: #4b5563;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 4px 4px 8px #bebebe, -4px -4px 8px #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .neumorphic-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 6px 6px 12px #bebebe, -6px -6px 12px #ffffff;
                }

                .neumorphic-button:active {
                    box-shadow: inset 3px 3px 6px #bebebe, inset -3px -3px 6px #ffffff;
                }

                /* Navigation Links */
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
                    box-shadow: 2px 2px 4px #bebebe, -2px -2px 4px #ffffff;
                }

                .secondary-nav-link:hover {
                    transform: translateY(-2px);
                    box-shadow: 4px 4px 8px #bebebe, -4px -4px 8px #ffffff;
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
                    inset: -2px;
                    border-radius: 12px;
                    background: linear-gradient(45deg, #8b5cf6, #ec4899);
                    z-index: -1;
                    opacity: 0.3;
                    transition: opacity 0.3s ease;
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

                /* Social Icons */
                .social-icon-button {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    background: #e8e8e8;
                    border: none;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 2px 2px 4px #bebebe, -2px -2px 4px #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .social-icon-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 4px 4px 8px #bebebe, -4px -4px 8px #ffffff;
                    background-color: var(--social-color, #e8e8e8);
                    color: white !important;
                }

                /* User Menu */
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
                    box-shadow: 4px 4px 8px #bebebe, -4px -4px 8px #ffffff;
                }

                .neumorphic-user-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 6px 6px 12px #bebebe, -6px -6px 12px #ffffff;
                }

                /* Dropdown */
                .neumorphic-dropdown {
                    background: #e8e8e8;
                    border-radius: 12px;
                    box-shadow: 8px 8px 16px #bebebe, -8px -8px 16px #ffffff, 0 10px 30px rgba(0, 0, 0, 0.1);
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

                /* Mobile Navigation */
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
                    box-shadow: 4px 4px 8px #bebebe, -4px -4px 8px #ffffff;
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
                    box-shadow: 4px 4px 8px #bebebe, -4px -4px 8px #ffffff;
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
                    inset: -2px;
                    border-radius: 12px;
                    background: linear-gradient(45deg, #8b5cf6, #ec4899);
                    z-index: -1;
                    opacity: 0.3;
                }

                /* Mobile Menu Animation */
                @keyframes slideIn {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }

                .mobile-menu > div:last-child {
                    animation: slideIn 0.3s ease-out;
                }

                /* Focus Styles */
                .neumorphic-search:focus,
                .neumorphic-button:focus,
                .nav-link:focus,
                .secondary-nav-link:focus {
                    outline: 2px solid #dc2626;
                    outline-offset: 2px;
                }

                /* Responsive Search */
                @media (max-width: 1024px) {
                    .neumorphic-search {
                        width: 100%;
                    }

                    .neumorphic-search:focus {
                        width: 100%;
                    }
                }
            `}</style>
        </>
    );
}