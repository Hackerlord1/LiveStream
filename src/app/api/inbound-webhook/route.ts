import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    console.log('📨 Webhook received at:', new Date().toISOString());

    // Use raw text body for webhook verification
    const payload = await req.text();
    console.log('📦 Payload received:', payload.slice(0, 200) + '...');

    const id = req.headers.get('svix-id');
    const timestamp = req.headers.get('svix-timestamp');
    const signature = req.headers.get('svix-signature');

    console.log('🔑 Headers present:', {
      hasId: !!id,
      hasTimestamp: !!timestamp,
      hasSignature: !!signature,
    });

    if (!id || !timestamp || !signature) {
      console.error('❌ Missing webhook headers');
      return new NextResponse('Missing webhook headers', { status: 400 });
    }

    if (!process.env.RESEND_WEBHOOK_SECRET) {
      console.error('❌ Missing RESEND_WEBHOOK_SECRET');
      return new NextResponse('Server misconfiguration', { status: 500 });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('❌ Missing RESEND_API_KEY');
      return new NextResponse('Server misconfiguration', { status: 500 });
    }

    console.log('🔐 Verifying webhook signature...');

    const result = resend.webhooks.verify({
      payload,
      headers: {
        id,
        timestamp,
        signature,
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
    });

    console.log('✅ Webhook verified successfully');
    console.log('📧 Event type:', result.type);

    if (result.type !== 'email.received') {
      console.log('⚠️ Not an email.received event, ignoring');
      return NextResponse.json({ message: 'Ignored event', type: result.type }, { status: 200 });
    }

    const emailId = result.data?.email_id;

    if (!emailId) {
      console.error('❌ Missing email_id in webhook payload');
      return new NextResponse('Missing email_id', { status: 400 });
    }

    console.log('📥 Fetching email content for ID:', emailId);

    const { data: email, error: emailError } = await resend.emails.receiving.get(emailId);

    if (emailError) {
      console.error('❌ Failed to fetch received email:', emailError);
      return new NextResponse(`Failed to fetch email: ${emailError.message}`, { status: 500 });
    }

    if (!email) {
      console.error('❌ No email data returned');
      return new NextResponse('No email data returned', { status: 500 });
    }

    console.log('✅ Email fetched successfully');
    console.log('📨 From:', email.from);
    console.log('📨 Subject:', email.subject);

    const recipientList = Array.isArray(email.to) ? email.to.join(', ') : String(email.to ?? '');

    console.log('📤 Forwarding to Gmail...');

    const { error: sendError } = await resend.emails.send({
      from: 'Forwarded <noreply@inbound.bravestream.live>',
      to: ['hemankipkoechchirchir@gmail.com'],
      subject: `[Forwarded] ${email.subject || '(No subject)'}`,
      html: `
        <h2>New Email Received</h2>
        <p><strong>From:</strong> ${email.from || 'Unknown sender'}</p>
        <p><strong>To:</strong> ${recipientList}</p>
        <p><strong>Subject:</strong> ${email.subject || '(No subject)'}</p>
        <hr />
        ${email.html || `<pre>${email.text || 'No content available'}</pre>`}
      `,
    });

    if (sendError) {
      console.error('❌ Failed to forward email:', sendError);
      return new NextResponse(`Failed to forward email: ${sendError.message}`, { status: 500 });
    }

    console.log('✅ Email forwarded successfully');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('💥 Webhook error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}