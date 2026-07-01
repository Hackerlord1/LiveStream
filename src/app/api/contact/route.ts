import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(req: NextRequest) {
    try {
        const resendKey = process.env.RESEND_API_KEY;

        if (!resendKey) {
            return NextResponse.json(
                { error: 'RESEND_API_KEY not configured' },
                { status: 500 }
            );
        }

        const resend = new Resend(resendKey);

        const { name, email, subject, message } = await req.json();

        if (!name || !email || !subject || !message) {
            return NextResponse.json(
                { error: 'All fields required' },
                { status: 400 }
            );
        }

        const { error } = await resend.emails.send({
            from: 'BraveStream <noreply@inbound.bravestream.live>',
            to: 'hemankipkoechchir@gmail.com',
            replyTo: email,
            subject: `[Contact] ${subject} — ${name}`,
            html: `
                <h2>New Contact Message</h2>
                <p><strong>From:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <p>${message}</p>
            `,
        });

        if (error) {
            return NextResponse.json(
                { error: 'Failed to send' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { error: 'Server error' },
            { status: 500 }
        );
    }
}