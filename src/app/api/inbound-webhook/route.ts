// src/app/api/inbound-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    // Log 1: Webhook was called
    console.log("📨 Webhook received at:", new Date().toISOString());

    const payload = await req.text();
    console.log("📦 Payload received:", payload.substring(0, 200) + "..."); // Log first 200 chars

    const id = req.headers.get('svix-id');
    const timestamp = req.headers.get('svix-timestamp');
    const signature = req.headers.get('svix-signature');

    console.log("🔑 Headers present:", { 
      hasId: !!id, 
      hasTimestamp: !!timestamp, 
      hasSignature: !!signature 
    });

    if (!id || !timestamp || !signature) {
      console.error("❌ Missing webhook headers");
      return new NextResponse('Missing headers', { status: 400 });
    }

    // Log 2: Verify webhook
    console.log("🔐 Verifying webhook signature...");
    const result = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
    });
    console.log("✅ Webhook verified successfully");

    // Log 3: Check event type
    console.log("📧 Event type:", result.type);
    if (result.type !== 'email.received') {
      console.log("⚠️ Not an email.received event, ignoring");
      return NextResponse.json({ message: 'Invalid event' }, { status: 200 });
    }

    // Log 4: Fetch email content
    console.log("📥 Fetching email content for ID:", result.data.email_id);
    const { data: email, error: emailError } = await resend.emails.receiving.get(result.data.email_id);
    
    if (emailError) {
      console.error("❌ Failed to fetch email:", emailError);
      throw new Error(`Failed to fetch email: ${emailError.message}`);
    }
    console.log("✅ Email fetched successfully");
    console.log("📨 From:", email.from);
    console.log("📨 Subject:", email.subject);

    // Log 5: Forward to your Gmail
    console.log("📤 Forwarding to hemankipkoechchirchir@gmail.com...");
    const { error: sendError } = await resend.emails.send({
      from: 'Forwarded <noreply@sms.bravestream.live>',
      to: ['hemankipkoechchirchir@gmail.com'],
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

    if (sendError) {
      console.error("❌ Failed to forward:", sendError);
      throw new Error(`Failed to forward: ${sendError.message}`);
    }
    console.log("✅ Email forwarded successfully!");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("💥 Webhook error:", error);
    return new NextResponse(`Error: ${error}`, { status: 500 });
  }
}