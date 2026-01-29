// src/app/api-test/page.tsx
'use client';

import { useState } from 'react';
import { API_CONFIG } from '@/lib/api';

export default function ApiTestPage() {
    const [result, setResult] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const testDirectFetch = async () => {
        setLoading(true);
        setResult('Fetching...');
        
        try {
            const url = API_CONFIG.ENDPOINTS.SPORTS;
            console.log('🔗 Fetching URL:', url);
            
            const response = await fetch(url);
            console.log('📡 Response status:', response.status);
            console.log('📡 Response ok:', response.ok);
            
            const text = await response.text();
            console.log('📦 Raw response length:', text.length);
            console.log('📦 First 500 chars:', text.substring(0, 500));
            
            try {
                const json = JSON.parse(text);
                console.log('✅ Parsed JSON:', json);
                console.log('✅ Has cdn-live-tv:', !!json['cdn-live-tv']);
                
                if (json['cdn-live-tv']) {
                    const sports = json['cdn-live-tv'];
                    console.log('⚽ Soccer:', Array.isArray(sports.Soccer) ? sports.Soccer.length : 'not array');
                    console.log('🏀 NBA:', Array.isArray(sports.NBA) ? sports.NBA.length : 'not array');
                    console.log('🏈 NFL:', Array.isArray(sports.NFL) ? sports.NFL.length : 'not array');
                    console.log('🏒 NHL:', Array.isArray(sports.NHL) ? sports.NHL.length : 'not array');
                    
                    if (sports.Soccer?.[0]) {
                        console.log('📋 First match:', sports.Soccer[0]);
                    }
                }
                
                setResult(JSON.stringify(json, null, 2));
            } catch (parseError) {
                console.error('❌ JSON parse error:', parseError);
                setResult(`JSON Parse Error: ${parseError}\n\nRaw: ${text.substring(0, 1000)}`);
            }
        } catch (error) {
            console.error('❌ Fetch error:', error);
            setResult(`Fetch Error: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <h1 className="text-3xl font-bold mb-6">API Direct Test</h1>
            
            <div className="mb-4 p-4 bg-blue-100 rounded">
                <strong>Endpoint:</strong><br />
                <code className="text-sm break-all">{API_CONFIG.ENDPOINTS.SPORTS}</code>
            </div>
            
            <button
                onClick={testDirectFetch}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 mb-6"
            >
                {loading ? 'Loading...' : 'Test Direct Fetch'}
            </button>
            
            <div className="mt-4">
                <h2 className="text-xl font-bold mb-2">Result:</h2>
                <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-auto max-h-[600px] text-xs">
                    {result || 'Click the button to test'}
                </pre>
            </div>
            
            <div className="mt-6 p-4 bg-yellow-100 rounded">
                <strong>👀 Check the browser console (F12) for detailed logs!</strong>
            </div>
        </div>
    );
}