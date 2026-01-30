// src/app/debug/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useAdBlock } from '@/app/providers/AdBlockProvider';

// Test URLs for quick testing
const TEST_URLS = [
    // Ad Networks
    { category: 'Google Ads', url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js' },
    { category: 'Google Ads', url: 'https://googleads.g.doubleclick.net/pagead/id' },
    { category: 'Google Analytics', url: 'https://www.google-analytics.com/analytics.js' },
    { category: 'Google Tag Manager', url: 'https://www.googletagmanager.com/gtag/js?id=UA-XXXXX' },
    
    // Social Media
    { category: 'Facebook Pixel', url: 'https://connect.facebook.net/en_US/fbevents.js' },
    { category: 'Facebook Ads', url: 'https://pixel.facebook.com/tr' },
    { category: 'Twitter Ads', url: 'https://ads.twitter.com/uwt.js' },
    
    // Ad Networks
    { category: 'Criteo', url: 'https://static.criteo.net/js/ld/ld.js' },
    { category: 'Taboola', url: 'https://cdn.taboola.com/libtrc/loader.js' },
    { category: 'Outbrain', url: 'https://widgets.outbrain.com/outbrain.js' },
    { category: 'Amazon Ads', url: 'https://amazon-adsystem.com/aax2/apstag.js' },
    
    // Trackers
    { category: 'Hotjar', url: 'https://static.hotjar.com/c/hotjar-123.js' },
    { category: 'Mixpanel', url: 'https://cdn.mixpanel.com/mixpanel-2-latest.min.js' },
    { category: 'Segment', url: 'https://cdn.segment.io/analytics.js/v1/xxx/analytics.min.js' },
    
    // Video Ads
    { category: 'Google IMA SDK', url: 'https://imasdk.googleapis.com/js/sdkloader/ima3.js' },
    
    // Tracking URLs with params
    { category: 'UTM Tracking', url: 'https://example.com/page?utm_source=google&utm_medium=cpc&utm_campaign=test' },
    { category: 'Facebook Click ID', url: 'https://example.com/landing?fbclid=IwAR3xxxxx' },
    { category: 'Google Click ID', url: 'https://example.com/product?gclid=Cj0KCQxxxxx' },
    
    // Safe URLs (should NOT be blocked)
    { category: 'Safe - Google', url: 'https://www.google.com/search?q=test' },
    { category: 'Safe - YouTube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    { category: 'Safe - GitHub', url: 'https://github.com/vercel/next.js' },
    { category: 'Safe - Your Site', url: 'https://bravestream.live/channels' },
];

// Group URLs by category
const groupedUrls = TEST_URLS.reduce((acc, item) => {
    if (!acc[item.category]) {
        acc[item.category] = [];
    }
    acc[item.category].push(item.url);
    return acc;
}, {} as Record<string, string[]>);

export default function DebugPage() {
    const { 
        isEnabled, 
        stats, 
        enable, 
        disable, 
        toggle, 
        testUrl, 
        stripTrackingParams,
        addToWhitelist,
        removeFromWhitelist 
    } = useAdBlock();
    
    const [testInput, setTestInput] = useState('');
    const [testResult, setTestResult] = useState<any>(null);
    const [strippedUrl, setStrippedUrl] = useState('');
    const [bulkResults, setBulkResults] = useState<any[]>([]);
    const [whitelistInput, setWhitelistInput] = useState('');
    const [whitelistedDomains, setWhitelistedDomains] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'test' | 'bulk' | 'whitelist' | 'logs'>('test');
    const [logs, setLogs] = useState<string[]>([]);

    // Capture console logs
    useEffect(() => {
        const originalLog = console.log;
        console.log = (...args) => {
            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
            
            if (message.includes('[BraveStream Shield]')) {
                setLogs(prev => [...prev.slice(-99), `${new Date().toLocaleTimeString()} - ${message}`]);
            }
            originalLog.apply(console, args);
        };

        return () => {
            console.log = originalLog;
        };
    }, []);

    const handleTest = () => {
        if (!testInput) return;
        
        const result = testUrl(testInput);
        setTestResult(result);
        setStrippedUrl(stripTrackingParams(testInput));
    };

    const handleBulkTest = () => {
        const results = TEST_URLS.map(item => ({
            ...item,
            result: testUrl(item.url),
            stripped: stripTrackingParams(item.url),
        }));
        setBulkResults(results);
    };

    const handleAddWhitelist = () => {
        if (!whitelistInput) return;
        addToWhitelist(whitelistInput);
        setWhitelistedDomains(prev => [...prev, whitelistInput]);
        setWhitelistInput('');
    };

    const handleRemoveWhitelist = (domain: string) => {
        removeFromWhitelist(domain);
        setWhitelistedDomains(prev => prev.filter(d => d !== domain));
    };

    const clearLogs = () => setLogs([]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
            {/* Header */}
            <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="text-3xl">🛡️</div>
                            <div>
                                <h1 className="text-2xl font-bold">BraveStream Shield</h1>
                                <p className="text-sm text-gray-400">Ad Blocker Debug Console</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                                isEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                                <div className={`w-3 h-3 rounded-full ${
                                    isEnabled ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                                }`} />
                                <span className="font-medium">
                                    {isEnabled ? 'Protection Active' : 'Protection Disabled'}
                                </span>
                            </div>
                            
                            <button
                                onClick={toggle}
                                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                                    isEnabled 
                                        ? 'bg-red-600 hover:bg-red-700' 
                                        : 'bg-green-600 hover:bg-green-700'
                                }`}
                            >
                                {isEnabled ? 'Disable' : 'Enable'}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <StatCard 
                        icon="🚫" 
                        label="Total Blocked" 
                        value={stats.totalBlocked} 
                        color="red" 
                    />
                    <StatCard 
                        icon="🌐" 
                        label="By Domain" 
                        value={stats.blockedByDomain} 
                        color="orange" 
                    />
                    <StatCard 
                        icon="🔍" 
                        label="By Pattern" 
                        value={stats.blockedByPattern} 
                        color="yellow" 
                    />
                    <StatCard 
                        icon="📋" 
                        label="Domains in List" 
                        value={stats.domainsInList} 
                        color="blue" 
                    />
                    <StatCard 
                        icon="⚡" 
                        label="Patterns" 
                        value={stats.patternsInList} 
                        color="purple" 
                    />
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-gray-700">
                    {[
                        { id: 'test', label: '🧪 Single Test', },
                        { id: 'bulk', label: '📊 Bulk Test' },
                        { id: 'whitelist', label: '✅ Whitelist' },
                        { id: 'logs', label: '📜 Live Logs' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-6 py-3 font-medium transition-all border-b-2 -mb-[2px] ${
                                activeTab === tab.id
                                    ? 'border-red-500 text-red-400'
                                    : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="bg-gray-800/50 rounded-xl p-6 backdrop-blur-sm border border-gray-700">
                    {/* Single Test Tab */}
                    {activeTab === 'test' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Enter URL to Test
                                </label>
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        value={testInput}
                                        onChange={(e) => setTestInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleTest()}
                                        placeholder="https://ads.example.com/track?utm_source=test"
                                        className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    />
                                    <button
                                        onClick={handleTest}
                                        className="px-8 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
                                    >
                                        Test URL
                                    </button>
                                </div>
                            </div>

                            {testResult && (
                                <div className={`p-6 rounded-lg border ${
                                    testResult.blocked 
                                        ? 'bg-red-900/30 border-red-500/50' 
                                        : 'bg-green-900/30 border-green-500/50'
                                }`}>
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="text-4xl">
                                            {testResult.blocked ? '🚫' : '✅'}
                                        </span>
                                        <div>
                                            <h3 className="text-xl font-bold">
                                                {testResult.blocked ? 'BLOCKED' : 'ALLOWED'}
                                            </h3>
                                            {testResult.blocked && (
                                                <p className="text-gray-300">
                                                    This URL would be blocked by BraveStream Shield
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {testResult.blocked && (
                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                            <div className="bg-gray-800/50 p-4 rounded-lg">
                                                <div className="text-sm text-gray-400">Block Reason</div>
                                                <div className="font-mono text-red-400">{testResult.reason}</div>
                                            </div>
                                            <div className="bg-gray-800/50 p-4 rounded-lg">
                                                <div className="text-sm text-gray-400">Matched Rule</div>
                                                <div className="font-mono text-red-400 break-all">{testResult.matchedRule}</div>
                                            </div>
                                        </div>
                                    )}

                                    {strippedUrl !== testInput && (
                                        <div className="mt-4 p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg">
                                            <div className="text-sm text-blue-300 mb-2">🧹 Tracking Parameters Stripped:</div>
                                            <div className="font-mono text-sm text-gray-300 break-all">
                                                <div className="line-through text-red-400/70 mb-1">{testInput}</div>
                                                <div className="text-green-400">{strippedUrl}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Quick Test Buttons */}
                            <div>
                                <h4 className="text-sm font-medium text-gray-300 mb-3">Quick Test URLs:</h4>
                                <div className="space-y-3">
                                    {Object.entries(groupedUrls).slice(0, 6).map(([category, urls]) => (
                                        <div key={category}>
                                            <div className="text-xs text-gray-500 mb-1">{category}</div>
                                            <div className="flex flex-wrap gap-2">
                                                {urls.map((url, i) => {
                                                    const hostname = new URL(url).hostname;
                                                    return (
                                                        <button
                                                            key={i}
                                                            onClick={() => {
                                                                setTestInput(url);
                                                                const result = testUrl(url);
                                                                setTestResult(result);
                                                                setStrippedUrl(stripTrackingParams(url));
                                                            }}
                                                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-mono transition-colors"
                                                        >
                                                            {hostname}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bulk Test Tab */}
                    {activeTab === 'bulk' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold">Bulk URL Testing</h3>
                                    <p className="text-sm text-gray-400">
                                        Test {TEST_URLS.length} common ad/tracking URLs
                                    </p>
                                </div>
                                <button
                                    onClick={handleBulkTest}
                                    className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
                                >
                                    Run All Tests
                                </button>
                            </div>

                            {bulkResults.length > 0 && (
                                <>
                                    {/* Summary */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4 text-center">
                                            <div className="text-3xl font-bold text-green-400">
                                                {bulkResults.filter(r => r.result.blocked).length}
                                            </div>
                                            <div className="text-sm text-gray-300">Blocked</div>
                                        </div>
                                        <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 text-center">
                                            <div className="text-3xl font-bold text-yellow-400">
                                                {bulkResults.filter(r => !r.result.blocked).length}
                                            </div>
                                            <div className="text-sm text-gray-300">Allowed</div>
                                        </div>
                                        <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 text-center">
                                            <div className="text-3xl font-bold text-blue-400">
                                                {bulkResults.filter(r => r.stripped !== r.url).length}
                                            </div>
                                            <div className="text-sm text-gray-300">Params Stripped</div>
                                        </div>
                                    </div>

                                    {/* Results Table */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-gray-700">
                                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Category</th>
                                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">URL</th>
                                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Reason</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bulkResults.map((item, i) => (
                                                    <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                                        <td className="py-3 px-4">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                                                item.result.blocked 
                                                                    ? 'bg-red-500/20 text-red-400' 
                                                                    : 'bg-green-500/20 text-green-400'
                                                            }`}>
                                                                {item.result.blocked ? '🚫 Blocked' : '✅ Allowed'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-300">
                                                            {item.category}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <code className="text-xs text-gray-400 break-all">
                                                                {new URL(item.url).hostname}
                                                            </code>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm">
                                                            {item.result.blocked ? (
                                                                <span className="text-red-400">{item.result.reason}</span>
                                                            ) : (
                                                                <span className="text-gray-500">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Whitelist Tab */}
                    {activeTab === 'whitelist' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Manage Whitelist</h3>
                                <p className="text-sm text-gray-400 mb-4">
                                    Add domains that should never be blocked. Use this for trusted services you need.
                                </p>
                                
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        value={whitelistInput}
                                        onChange={(e) => setWhitelistInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddWhitelist()}
                                        placeholder="example.com"
                                        className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    />
                                    <button
                                        onClick={handleAddWhitelist}
                                        className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
                                    >
                                        Add to Whitelist
                                    </button>
                                </div>
                            </div>

                            {whitelistedDomains.length > 0 ? (
                                <div>
                                    <h4 className="text-sm font-medium text-gray-300 mb-3">
                                        Whitelisted Domains ({whitelistedDomains.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {whitelistedDomains.map((domain, i) => (
                                            <div 
                                                key={i}
                                                className="flex items-center justify-between bg-gray-700/50 px-4 py-3 rounded-lg"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-green-400">✓</span>
                                                    <code className="text-gray-300">{domain}</code>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveWhitelist(domain)}
                                                    className="text-red-400 hover:text-red-300 transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500">
                                    <div className="text-4xl mb-3">📋</div>
                                    <p>No domains whitelisted yet</p>
                                </div>
                            )}

                            {/* Suggested Whitelist */}
                            <div className="border-t border-gray-700 pt-6">
                                <h4 className="text-sm font-medium text-gray-300 mb-3">
                                    Suggested Domains to Whitelist
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        'plausible.io',
                                        'api.bravestream.live',
                                        'cdn.bravestream.live',
                                    ].map(domain => (
                                        <button
                                            key={domain}
                                            onClick={() => {
                                                addToWhitelist(domain);
                                                setWhitelistedDomains(prev => [...prev, domain]);
                                            }}
                                            disabled={whitelistedDomains.includes(domain)}
                                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                                whitelistedDomains.includes(domain)
                                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                            }`}
                                        >
                                            + {domain}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Logs Tab */}
                    {activeTab === 'logs' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold">Live Blocking Logs</h3>
                                    <p className="text-sm text-gray-400">
                                        Real-time view of blocked requests
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={clearLogs}
                                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                                    >
                                        Clear Logs
                                    </button>
                                    <button
                                        onClick={() => {
                                            // Trigger some test requests
                                            fetch('https://pagead2.googlesyndication.com/test');
                                            fetch('https://www.google-analytics.com/collect');
                                            fetch('https://connect.facebook.net/test');
                                        }}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors"
                                    >
                                        Trigger Test Requests
                                    </button>
                                </div>
                            </div>

                            <div className="bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
                                {logs.length > 0 ? (
                                    <div className="space-y-1">
                                        {logs.map((log, i) => (
                                            <div 
                                                key={i}
                                                className={`${
                                                    log.includes('Blocked') 
                                                        ? 'text-red-400' 
                                                        : log.includes('Cleaned')
                                                            ? 'text-blue-400'
                                                            : 'text-gray-400'
                                                }`}
                                            >
                                                {log}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-500">
                                        <div className="text-center">
                                            <div className="text-4xl mb-3">📜</div>
                                            <p>No logs yet. Browse the site to see blocked requests.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                    <span>Blocked</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                                    <span>Cleaned</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                                    <span>Info</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* How It Works Section */}
                <div className="mt-8 bg-gray-800/30 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold mb-4">🔬 How BraveStream Shield Works</h3>
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <div className="text-2xl">🌐</div>
                            <h4 className="font-medium">Domain Blocking</h4>
                            <p className="text-sm text-gray-400">
                                Maintains a list of {stats.domainsInList}+ known ad and tracking domains. 
                                Any request to these domains is blocked instantly.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <div className="text-2xl">🔍</div>
                            <h4 className="font-medium">Pattern Matching</h4>
                            <p className="text-sm text-gray-400">
                                Uses {stats.patternsInList} regex patterns to catch URLs with tracking 
                                parameters or ad-related paths like /ads/, /track/, /pixel/.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <div className="text-2xl">🧹</div>
                            <h4 className="font-medium">Parameter Stripping</h4>
                            <p className="text-sm text-gray-400">
                                Removes tracking parameters (utm_*, fbclid, gclid, etc.) from URLs 
                                while allowing the request to proceed.
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-gray-800 py-6 mt-8">
                <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
                    <p>BraveStream Shield - Brave-style ad blocking for educational purposes</p>
                    <p className="mt-1">
                        <a href="/" className="text-red-400 hover:text-red-300">← Back to BraveStream</a>
                    </p>
                </div>
            </footer>
        </div>
    );
}

// Stat Card Component
function StatCard({ 
    icon, 
    label, 
    value, 
    color 
}: { 
    icon: string; 
    label: string; 
    value: number; 
    color: 'red' | 'orange' | 'yellow' | 'blue' | 'purple' | 'green';
}) {
    const colorClasses = {
        red: 'from-red-500/20 to-red-600/10 border-red-500/30 text-red-400',
        orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-400',
        yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 text-yellow-400',
        blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
        purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
        green: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400',
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{icon}</span>
                <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
            </div>
            <div className={`text-3xl font-bold ${colorClasses[color].split(' ').pop()}`}>
                {value.toLocaleString()}
            </div>
        </div>
    );
}