// src/app/test-match/[id]/page.tsx - SIMPLE TEST
import { getMatchById } from '@/lib/match-utils';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function TestMatchPage({ params }: PageProps) {
    const { id } = await params;
    const match = await getMatchById(id);

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-6">Test Match Page</h1>

            <div className="mb-6 p-4 bg-gray-100 rounded">
                <p><strong>URL Parameter (id):</strong> {id}</p>
                <p><strong>Match Found:</strong> {match ? 'YES' : 'NO'}</p>
            </div>

            {match ? (
                <div className="p-6 bg-green-50 border border-green-200 rounded">
                    <h2 className="text-2xl font-bold mb-4">✅ Match Found!</h2>
                    <div className="space-y-2">
                        <p><strong>ID:</strong> {match.gameID}</p>
                        <p><strong>Match:</strong> {match.homeTeam} vs {match.awayTeam}</p>
                        <p><strong>Status:</strong> {match.status}</p>
                        <p><strong>Tournament:</strong> {match.tournament}</p>
                    </div>
                </div>
            ) : (
                <div className="p-6 bg-red-50 border border-red-200 rounded">
                    <h2 className="text-2xl font-bold mb-4">❌ No Match Found</h2>
                    <p>Could not find match with ID: {id}</p>
                </div>
            )}

            <div className="mt-8">
                <a href="/" className="text-blue-600 hover:underline">
                    ← Back to homepage
                </a>
            </div>
        </div>
    );
}