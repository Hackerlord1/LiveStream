// src/app/match/[id]/page.tsx - CLEAN STREAMING DESIGN
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import MatchPlayer from './MatchPlayer';
import { fetchAllMatches, Match } from '@/lib/api';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getMatchData(id: string): Promise<Match | null> {
  try {
    const allMatches = await fetchAllMatches();
    const match = allMatches.find(m => m.gameID === id);

    if (!match) {
      console.error(`Match not found: ${id}`);
      return null;
    }

    console.log(`Found match: ${match.homeTeam} vs ${match.awayTeam}`);
    return match;
  } catch (error) {
    console.error('Failed to fetch match:', error);
    return null;
  }
}

export default async function MatchPage({ params }: PageProps) {
  const { id } = await params;
  const match = await getMatchData(id);

  if (!match) {
    notFound();
  }

  return (
      <Suspense fallback={<MatchLoadingSkeleton />}>
        <MatchPlayer match={match} />
      </Suspense>
  );
}

// Update the MatchLoadingSkeleton function
function MatchLoadingSkeleton() {
  return (
      <div className="min-h-screen bg-[#e8e8e8]">
        {/* Header Skeleton */}
        <header className="bg-[#e8e8e8] border-b border-gray-300 py-3">
          <div className="max-w-7xl mx-auto px-4">
            <div className="h-10 w-32 bg-gray-300 rounded-lg animate-pulse"></div>
          </div>
        </header>

        <div className="relative max-w-7xl mx-auto px-4 py-6">
          {/* Match Header Skeleton */}
          <div className="neumorphic-card mb-6 animate-pulse">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center justify-center gap-4 md:gap-8 flex-1">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-3"></div>
                  <div className="h-4 bg-gray-300 rounded w-20 mx-auto mb-1"></div>
                  <div className="h-6 bg-gray-300 rounded w-8 mx-auto"></div>
                </div>

                <div className="text-center">
                  <div className="h-6 bg-gray-300 rounded w-16 mx-auto mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded w-8 mx-auto mb-1"></div>
                  <div className="h-3 bg-gray-300 rounded w-12 mx-auto"></div>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-3"></div>
                  <div className="h-4 bg-gray-300 rounded w-20 mx-auto mb-1"></div>
                  <div className="h-6 bg-gray-300 rounded w-8 mx-auto"></div>
                </div>
              </div>

              <div className="h-10 w-24 bg-gray-300 rounded-lg"></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Player Area Skeleton */}
            <div className="lg:col-span-2 space-y-4">
              {/* Video Player Placeholder */}
              <div className="neumorphic-video-container">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-4"></div>
                    <div className="h-4 bg-gray-300 rounded w-32 mx-auto mb-2"></div>
                    <div className="h-3 bg-gray-300 rounded w-24 mx-auto"></div>
                  </div>
                </div>
              </div>

              {/* Servers Skeleton */}
              <div className="neumorphic-card animate-pulse">
                <div className="h-6 bg-gray-300 rounded w-32 mb-4"></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-gray-300 rounded-lg"></div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar Skeleton */}
            <aside className="lg:col-span-1 space-y-6">
              <div className="neumorphic-card animate-pulse">
                <div className="h-6 bg-gray-300 rounded w-32 mb-4"></div>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-gray-300 rounded-lg"></div>
                  ))}
                </div>
              </div>

              <div className="neumorphic-card animate-pulse">
                <div className="h-6 bg-gray-300 rounded w-32 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-8 bg-gray-300 rounded-lg"></div>
                  <div className="h-8 bg-gray-300 rounded-lg"></div>
                  <div className="h-8 bg-gray-300 rounded-lg"></div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
  );

}