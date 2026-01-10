// src/app/debug/page.tsx - CREATE THIS FILE
import { fetchAllMatches } from '@/lib/api';

export default async function DebugPage() {
    const matches = await fetchAllMatches();

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-6">Debug Page</h1>
            <div className="mb-6 p-4 bg-yellow-100 text-yellow-800 rounded">
                <p>Total matches: {matches.length}</p>
                <p>Testing ID: 0YcqUK97</p>
            </div>

            <h2 className="text-2xl font-bold mb-4">All Matches:</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matches.map(match => (
                    <div key={match.gameID} className="border p-4 rounded">
                        <div className="font-mono text-sm bg-gray-100 p-2 rounded mb-2">
                            ID: {match.gameID}
                        </div>
                        <div className="text-lg font-bold">
                            {match.homeTeam} vs {match.awayTeam}
                        </div>
                        <div className="text-sm text-gray-600">
                            {match.tournament} • {match.status}
                        </div>
                        <a
                            href={`/match/${match.gameID}`}
                            className="mt-2 inline-block text-blue-600 hover:underline"
                        >
                            Test Link: /match/{match.gameID}
                        </a>
                    </div>
                ))}
            </div>
        </div>
    );
}