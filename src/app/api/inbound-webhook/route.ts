// src/app/api/inbound-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    // 1. Get the raw payload and headers for verification
    const payload = await req.text();
    const headers = {
      id: req.headers.get('svix-id') || '',
      timestamp: req.headers.get('svix-timestamp') || '',
      signature: req.headers.get('svix-signature') || '',
    };

    // 2. Verify the webhook is really from Resend (Security)
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret) {
      const verifiedPayload = resend.webhooks.verify({
        payload,
        headers,
        webhookSecret,
      });
      if (verifiedPayload.type !== 'email.received') {
        return NextResponse.json({ message: 'Invalid event' }, { status: 200 });
      }
    }

    // 3. Parse the payload to get the email ID
    const body = JSON.parse(payload);
    const emailId = body.data.email_id;

    // 4. Fetch the full email content from Resend
    const { data: email, error: fetchError } = await resend.emails.receiving.get(emailId);
    if (fetchError) throw new Error(`Failed to fetch email: ${fetchError.message}`);

    // 5. Forward the email to your personal Gmail
    const { error: sendError } = await resend.emails.send({
      from: 'Forwarded <noreply@sms.bravestream.live>', // Use your verified subdomain
      to: ['hemankipkoechchirchir@gmail.com'],        // Your Gmail address
      subject: `[Forwarded] ${email.subject}`,
      html: `
        <h2>New Email Received</h2>
        <p><strong>From:</strong> ${email.from}</p>
        <p><strong>To:</strong> ${email.to}</p>
        <p><strong>Subject:</strong> ${email.subject}</p>
        <hr/>
        ${email.html || `<p>${email.text}</p>`}
      `,
    });

    if (sendError) throw new Error(`Failed to forward: ${sendError.message}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}