// src/app/match/[id]/loading.tsx
export default function Loading() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
            <div className="max-w-7xl mx-auto px-4 py-6 animate-pulse">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Match Header */}
                        <div className="bg-gray-800/50 rounded-2xl p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="w-16 h-16 bg-gray-700 rounded-full"></div>
                                    <div>
                                        <div className="h-6 w-32 bg-gray-700 rounded mb-2"></div>
                                        <div className="h-8 w-16 bg-gray-700 rounded"></div>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="h-4 w-24 bg-gray-700 rounded mx-auto mb-2"></div>
                                    <div className="h-10 w-20 bg-gray-700 rounded mx-auto"></div>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <div>
                                        <div className="h-6 w-32 bg-gray-700 rounded mb-2"></div>
                                        <div className="h-8 w-16 bg-gray-700 rounded"></div>
                                    </div>
                                    <div className="w-16 h-16 bg-gray-700 rounded-full"></div>
                                </div>
                            </div>
                        </div>

                        {/* Video Player */}
                        <div className="bg-gray-800/50 rounded-2xl aspect-video"></div>

                        {/* Streams */}
                        <div className="bg-gray-800/50 rounded-2xl p-6">
                            <div className="h-6 w-48 bg-gray-700 rounded mb-4"></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="bg-gray-700/50 rounded-xl p-4">
                                        <div className="flex items-center space-x-3 mb-3">
                                            <div className="w-12 h-12 bg-gray-700 rounded-lg"></div>
                                            <div className="flex-1">
                                                <div className="h-4 w-24 bg-gray-700 rounded mb-2"></div>
                                                <div className="h-3 w-32 bg-gray-700 rounded"></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Chat */}
                        <div className="bg-gray-800/50 rounded-2xl p-6">
                            <div className="h-6 w-32 bg-gray-700 rounded mb-4"></div>
                            <div className="space-y-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="flex items-start space-x-3">
                                        <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                                        <div className="flex-1">
                                            <div className="h-4 w-24 bg-gray-700 rounded mb-2"></div>
                                            <div className="h-3 w-full bg-gray-700 rounded"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}