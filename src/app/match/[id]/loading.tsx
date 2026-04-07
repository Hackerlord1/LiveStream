// src/app/match/[id]/loading.tsx
export default function MatchLoadingSkeleton() {
    return (
        <div className="min-h-screen bg-[#e8e8e8] text-gray-900">
            {/* Header — matches MatchPlayer's real header */}
            <header className="bg-[#e8e8e8] border-b border-gray-300 py-3 shadow-sm sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#e0e0e0]"
                             style={{ boxShadow: '4px 4px 8px #bebebe, -4px -4px 8px #ffffff' }}>
                            <div className="w-4 h-4 bg-gray-300 rounded" />
                            <div className="hidden sm:block w-24 h-4 bg-gray-300 rounded" />
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#e0e0e0]"
                                 style={{ boxShadow: '4px 4px 8px #bebebe, -4px -4px 8px #ffffff' }} />
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-300">
                                <div className="w-2 h-2 rounded-full bg-gray-300" />
                                <div className="w-10 h-4 bg-gray-200 rounded" />
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="relative">
                <div className="max-w-7xl mx-auto px-4 py-6">

                    {/* Match Header Card — matches real scoreboard shape */}
                    <div className="bg-[#e0e0e0] rounded-2xl p-5 mb-6 animate-pulse"
                         style={{ boxShadow: '6px 6px 12px #bebebe, -6px -6px 12px #ffffff' }}>
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center justify-center gap-4 md:gap-8 flex-1">
                                {/* Home team */}
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-3" />
                                    <div className="w-20 h-4 bg-gray-300 rounded mx-auto mb-2" />
                                    <div className="w-8 h-8 bg-gray-300 rounded mx-auto" />
                                </div>
                                {/* VS */}
                                <div className="text-center">
                                    <div className="w-16 h-6 bg-gray-300 rounded-full mx-auto mb-2" />
                                    <div className="w-8 h-5 bg-gray-300 rounded mx-auto mb-1" />
                                    <div className="w-24 h-3 bg-gray-300 rounded mx-auto" />
                                </div>
                                {/* Away team */}
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-3" />
                                    <div className="w-20 h-4 bg-gray-300 rounded mx-auto mb-2" />
                                    <div className="w-8 h-8 bg-gray-300 rounded mx-auto" />
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="w-24 h-4 bg-gray-300 rounded mx-auto mb-1" />
                                <div className="w-16 h-3 bg-gray-300 rounded mx-auto" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Player area */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Video container — matches neumorphic-video-container */}
                            <div className="neumorphic-video-container relative">
                                <div className="absolute inset-0 flex items-center justify-center bg-black/90 rounded-xl">
                                    <div className="text-center">
                                        <div className="loading-spinner h-12 w-12 mb-4 mx-auto" />
                                        <p className="text-gray-400 text-sm">Loading match...</p>
                                    </div>
                                </div>
                            </div>

                            {/* Server buttons skeleton */}
                            <div className="neumorphic-card animate-pulse">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-9 h-9 bg-gray-300 rounded-xl" />
                                    <div className="w-32 h-5 bg-gray-300 rounded" />
                                    <div className="w-16 h-5 bg-red-200 rounded-full" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="h-14 bg-gray-300 rounded-xl" />
                                    ))}
                                </div>
                            </div>

                            {/* Stream quality skeleton */}
                            <div className="neumorphic-card animate-pulse">
                                <div className="w-28 h-5 bg-gray-300 rounded mb-4" />
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="h-20 bg-gray-300 rounded-xl" />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Chat skeleton */}
                        <aside className="lg:col-span-1 space-y-6">
                            <div className="rounded-lg bg-white shadow-lg w-full overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
                                        <span className="font-semibold text-gray-900">Live Chat</span>
                                    </div>
                                    <div className="w-16 h-4 bg-gray-200 rounded animate-pulse" />
                                </div>
                                <div className="h-[400px] flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="loading-spinner h-8 w-8 mb-3 mx-auto" />
                                        <p className="text-gray-400 text-sm">Loading chat...</p>
                                    </div>
                                </div>
                                <div className="border-t border-gray-200">
                                    <div className="h-10 w-full bg-gray-100 rounded-b-lg" />
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </main>
        </div>
    );
}