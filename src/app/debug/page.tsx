// src/app/debug/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchAllMatches, API_CONFIG } from '@/lib/api';
import type { Match } from '@/lib/api';

export default function DebugPage() {
    const [matches, setMatches] = useState<Match[]>([]);
    const [rawResponse, setRawResponse] = useState<unknown>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [testId, setTestId] = useState('');

    useEffect(() => {
        async function loadData() {
            try {
                // Fetch raw response first
                console.log('🔗 Fetching from:', API_CONFIG.ENDPOINTS.SPORTS);
                const res = await fetch(API_CONFIG.ENDPOINTS.SPORTS);
                const raw = await res.json();
                setRawResponse(raw);
                console.log('📦 Raw API Response:', raw);

                // Now fetch through our API layer
                console.log('🔄 Fetching through fetchAllMatches...');
                const transformedMatches = await fetchAllMatches();
                console.log('✅ Transformed matches:', transformedMatches.length);
                console.log('📋 First 5 matches:', transformedMatches.slice(0, 5));
                
                setMatches(transformedMatches);

                // Set first match ID for testing
                if (transformedMatches.length > 0) {
                    setTestId(transformedMatches[0].gameID);
                }
            } catch (err) {
                console.error('❌ Error:', err);
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 p-8">
                <div className="animate-pulse text-xl">Loading...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-100 p-8">
                <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded">
                    <strong>Error:</strong> {error}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <h1 className="text-3xl font-bold mb-6">🔧 API Debug Dashboard</h1>

            {/* API Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h2 className="text-lg font-semibold mb-2">API Configuration</h2>
                <p><strong>Endpoint:</strong> <code className="bg-gray-200 px-2 py-1 rounded text-sm">{API_CONFIG.ENDPOINTS.SPORTS}</code></p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg p-4 shadow">
                    <div className="text-2xl font-bold text-blue-600">{matches.length}</div>
                    <div className="text-gray-600">Total Matches</div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow">
                    <div className="text-2xl font-bold text-green-600">
                        {matches.filter(m => m.status === 'live').length}
                    </div>
                    <div className="text-gray-600">Live</div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow">
                    <div className="text-2xl font-bold text-yellow-600">
                        {matches.filter(m => m.status === 'upcoming').length}
                    </div>
                    <div className="text-gray-600">Upcoming</div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow">
                    <div className="text-2xl font-bold text-gray-600">
                        {matches.filter(m => m.status === 'ended').length}
                    </div>
                    <div className="text-gray-600">Ended</div>
                </div>
            </div>

            {/* Test Match Link */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <h2 className="text-lg font-semibold mb-2">🧪 Test Match Link</h2>
                <div className="flex gap-4 items-center">
                    <input
                        type="text"
                        value={testId}
                        onChange={(e) => setTestId(e.target.value)}
                        placeholder="Enter gameID to test"
                        className="flex-1 px-4 py-2 border rounded"
                    />
                    <Link
                        href={`/match/${testId}`}
                        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Test Link
                    </Link>
                    <Link
                        href={`/match/${encodeURIComponent(testId)}`}
                        className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                        Test Encoded
                    </Link>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                    <p>Raw URL: <code>/match/{testId}</code></p>
                    <p>Encoded URL: <code>/match/{encodeURIComponent(testId)}</code></p>
                </div>
            </div>

            {/* Matches with Channels (more likely to work) */}
            <div className="bg-white rounded-lg shadow mb-6">
                <div className="p-4 border-b">
                    <h2 className="text-xl font-bold">📺 Matches with Channels ({matches.filter(m => m.channels.length > 0).length})</h2>
                </div>
                <div className="divide-y max-h-[400px] overflow-auto">
                    {matches
                        .filter(m => m.channels.length > 0)
                        .slice(0, 10)
                        .map((match, index) => (
                            <div key={match.gameID || index} className="p-4 hover:bg-gray-50">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-semibold">
                                            {match.homeTeam} vs {match.awayTeam}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            {match.tournament} • {match.sport} • {match.status}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            <strong>gameID:</strong>{' '}
                                            <code className="bg-gray-200 px-2 py-0.5 rounded">{match.gameID}</code>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            <strong>Channels:</strong> {match.channels.length}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Link
                                            href={`/match/${match.gameID}`}
                                            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                                        >
                                            Open Match
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                </div>
            </div>

            {/* All Matches List */}
            <div className="bg-white rounded-lg shadow mb-6">
                <div className="p-4 border-b">
                    <h2 className="text-xl font-bold">📋 All Matches (first 20)</h2>
                </div>
                <div className="divide-y max-h-[400px] overflow-auto">
                    {matches.slice(0, 20).map((match, index) => (
                        <div key={match.gameID || index} className="p-4 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-semibold">
                                        {match.homeTeam} vs {match.awayTeam}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {match.tournament} • {match.sport}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        <strong>gameID:</strong>{' '}
                                        <code className="bg-gray-200 px-2 py-0.5 rounded">{match.gameID}</code>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                        match.status === 'live' 
                                            ? 'bg-red-100 text-red-700' 
                                            : match.status === 'upcoming'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-gray-100 text-gray-700'
                                    }`}>
                                        {match.status.toUpperCase()}
                                    </span>
                                    <span className={`px-2 py-1 rounded text-xs ${
                                        match.channels.length > 0
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        {match.channels.length} channels
                                    </span>
                                    <Link
                                        href={`/match/${match.gameID}`}
                                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                                    >
                                        View
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Raw First Match */}
            <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b">
                    <h2 className="text-xl font-bold">🔍 Raw First Match Data</h2>
                </div>
                <pre className="p-4 bg-gray-900 text-green-400 overflow-auto max-h-[300px] text-xs rounded-b-lg">
                    {JSON.stringify(matches[0], null, 2)}
                </pre>
            </div>
        </div>
    );
}