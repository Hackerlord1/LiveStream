// src/app/privacy/page.tsx
import Header from "@/components/Header";

export default function PrivacyPage() {
    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--neu-bg-page)', color: 'var(--text-secondary)' }}>
            <Header />

            <main className="max-w-4xl mx-auto px-4 py-12">
                <h1 className="text-4xl font-bold text-center mb-12" style={{ color: 'var(--text-primary)' }}>
                    Privacy Policy
                </h1>

                <div className="space-y-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    <section>
                        <p className="mb-4" style={{ color: 'var(--text-muted)' }}>Last updated: January 06, 2026</p>
                        <p>We at BraveStream respect your privacy. This policy explains our practices.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                            Information We Collect
                        </h2>
                        <p>We do not collect personal information. This site provides public sports streams and does not require registration or logins.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                            Third-Party Streams
                        </h2>
                        <p>Streams are embedded from external sources. We do not control their data practices. Visit their sites for their privacy policies.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                            Cookies & Analytics
                        </h2>
                        <p>We use no cookies or tracking analytics.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                            Contact
                        </h2>
                        <p>
                            For questions, email us at:{' '}
                            <a href="mailto:privacy@bravestream.live" style={{ color: 'var(--link-color)' }} className="hover:underline">
                                privacy@bravestream.live
                            </a>
                        </p>
                    </section>
                </div>

                {/* Footer */}
                <div className="text-center mt-16">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        &copy; {new Date().getFullYear()} BraveStream. All rights reserved.
                    </p>
                </div>
            </main>
        </div>
    );
}