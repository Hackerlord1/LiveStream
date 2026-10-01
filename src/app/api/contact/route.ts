import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || 'hemankipkoechchir@gmail.com';

const MAX_LENGTHS = { name: 100, email: 200, subject: 200, message: 5000 } as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple per-IP limit: 3 messages per 10 minutes. In-memory, so it resets on
// deploy and is per-instance, but it stops casual spam without extra infra.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
const recentSubmissions = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const timestamps = (recentSubmissions.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (timestamps.length >= RATE_LIMIT_MAX) {
        recentSubmissions.set(ip, timestamps);
        return true;
    }
    timestamps.push(now);
    recentSubmissions.set(ip, timestamps);
    return false;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export async function POST(req: NextRequest) {
    try {
        const resendKey = process.env.RESEND_API_KEY;

        if (!resendKey) {
            console.error('RESEND_API_KEY not configured');
            return NextResponse.json({ error: 'Server error' }, { status: 500 });
        }

        const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
        if (isRateLimited(ip)) {
            return NextResponse.json(
                { error: 'Too many messages. Please try again later.' },
                { status: 429 }
            );
        }

        const body = await req.json();
        const fields = {
            name: typeof body?.name === 'string' ? body.name.trim() : '',
            email: typeof body?.email === 'string' ? body.email.trim() : '',
            subject: typeof body?.subject === 'string' ? body.subject.trim() : '',
            message: typeof body?.message === 'string' ? body.message.trim() : '',
        };

        if (!fields.name || !fields.email || !fields.subject || !fields.message) {
            return NextResponse.json({ error: 'All fields required' }, { status: 400 });
        }

        if (!EMAIL_PATTERN.test(fields.email)) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
        }

        for (const key of Object.keys(MAX_LENGTHS) as (keyof typeof MAX_LENGTHS)[]) {
            if (fields[key].length > MAX_LENGTHS[key]) {
                return NextResponse.json({ error: `${key} is too long` }, { status: 400 });
            }
        }

        const resend = new Resend(resendKey);
        const { error } = await resend.emails.send({
            from: 'BraveStream <noreply@inbound.bravestream.live>',
            to: CONTACT_TO_EMAIL,
            replyTo: fields.email,
            // Strip newlines so the subject can't be used to inject headers
            subject: `[Contact] ${fields.subject} — ${fields.name}`.replace(/[\r\n]+/g, ' '),
            html: `
                <h2>New Contact Message</h2>
                <p><strong>From:</strong> ${escapeHtml(fields.name)}</p>
                <p><strong>Email:</strong> ${escapeHtml(fields.email)}</p>
                <p><strong>Subject:</strong> ${escapeHtml(fields.subject)}</p>
                <p style="white-space: pre-wrap">${escapeHtml(fields.message)}</p>
            `,
        });

        if (error) {
            console.error('Resend send failed:', error);
            return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Contact route error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
