// src/app/api/contact/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
    try {
        const { name, email, subject, message } = await req.json();

        if (!name || !email || !subject || !message) {
            return NextResponse.json({ error: 'All fields required' }, { status: 400 });
        }

        const { error } = await resend.emails.send({
            from: 'BraveStream <noreply@inbound.bravestream.live>',
            to: 'hemankipkoechchirchir@gmail.com',
            replyTo: email,
            subject: `[Contact] ${subject} — ${name}`,
            html: `
                <h2 style="color:#dc2626;">New Contact Message</h2>
                <p><strong>From:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <hr/>
                <p style="white-space:pre-wrap;">${message}</p>
                <hr/>
                <p style="color:#999;font-size:12px;">Sent from BraveStream contact form</p>
            `,
        });

        if (error) {
            console.error('Resend error:', error);
            return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Contact error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}