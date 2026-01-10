// src/app/match/[id]/error.tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { FaExclamationTriangle, FaHome } from 'react-icons/fa';

export default function Error({
                                  error,
                                  reset,
                              }: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center px-4">
            <div className="text-center max-w-md">
                <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FaExclamationTriangle className="text-2xl" />
                </div>

                <h1 className="text-3xl font-bold mb-4">Stream Not Available</h1>
                <p className="text-gray-400 mb-8">
                    We couldn't load the match stream. This might be due to temporary issues or the match might have ended.
                </p>

                <div className="space-y-4">
                    <button
                        onClick={reset}
                        className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-semibold hover:opacity-90 transition"
                    >
                        Try Again
                    </button>

                    <Link
                        href="/"
                        className="w-full inline-block px-6 py-3 bg-gray-800 rounded-lg font-semibold hover:bg-gray-700 transition flex items-center justify-center space-x-2"
                    >
                        <FaHome />
                        <span>Back to Home</span>
                    </Link>
                </div>

                <p className="mt-8 text-sm text-gray-500">
                    Error: {error.message}
                </p>
            </div>
        </div>
    );
}