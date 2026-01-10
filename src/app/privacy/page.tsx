// src/app/privacy/page.tsx
export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100 py-20 px-4">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold text-center mb-12 text-white">Privacy Policy</h1>

                <div className="space-y-8 text-gray-300 leading-relaxed">
                    <section>
                        <p className="mb-4">Last updated: January 06, 2026</p>
                        <p>We at LiveSports respect your privacy. This policy explains our practices.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">Information We Collect</h2>
                        <p>We do not collect personal information. This site provides public sports streams and does not require registration or logins.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">Third-Party Streams</h2>
                        <p>Streams are embedded from external sources. We do not control their data practices. Visit their sites for their privacy policies.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">Cookies & Analytics</h2>
                        <p>We use no cookies or tracking analytics.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">Contact</h2>
                        <p>For questions, email us at: <a href="mailto:privacy@livesports.example" className="text-blue-400 hover:underline">privacy@livesports.example</a></p>
                    </section>
                </div>
            </div>
        </main>
    );
}