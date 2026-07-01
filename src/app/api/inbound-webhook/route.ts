import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(req: NextRequest) {
  try {
    console.log('📨 Webhook received at:', new Date().toISOString());

    const resendKey = process.env.RESEND_API_KEY;

    if (!resendKey) {
      console.error('❌ Missing RESEND_API_KEY');
      return new NextResponse('Server misconfiguration', { status: 500 });
    }

    const resend = new Resend(resendKey);

    const payload = await req.text();

    const id = req.headers.get('svix-id');
    const timestamp = req.headers.get('svix-timestamp');
    const signature = req.headers.get('svix-signature');

    if (!id || !timestamp || !signature) {
      console.error('❌ Missing webhook headers');
      return new NextResponse('Missing webhook headers', { status: 400 });
    }

    if (!process.env.RESEND_WEBHOOK_SECRET) {
      console.error('❌ Missing RESEND_WEBHOOK_SECRET');
      return new NextResponse('Server misconfiguration', { status: 500 });
    }

    const result = resend.webhooks.verify({
      payload,
      headers: {
        id,
        timestamp,
        signature,
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
    });

    if (result.type !== 'email.received') {
      return NextResponse.json(
        {
          message: 'Ignored event',
          type: result.type,
        },
        { status: 200 }
      );
    }

    const emailId = result.data?.email_id;

    if (!emailId) {
      return new NextResponse('Missing email_id', { status: 400 });
    }

    const {
      data: email,
      error: emailError,
    } = await resend.emails.receiving.get(emailId);

    if (emailError) {
      console.error(emailError);
      return new NextResponse(
        `Failed to fetch email: ${emailError.message}`,
        { status: 500 }
      );
    }

    if (!email) {
      return new NextResponse('No email data returned', {
        status: 500,
      });
    }

    const recipientList = Array.isArray(email.to)
      ? email.to.join(', ')
      : String(email.to ?? '');

    const { error: sendError } = await resend.emails.send({
      from: 'Forwarded <noreply@inbound.bravestream.live>',
      to: ['hemankipkoechchir@gmail.com'],
      subject: `[Forwarded] ${email.subject || '(No subject)'}`,
      html: `
        <h2>New Email Received</h2>
        <p><strong>From:</strong> ${email.from || 'Unknown sender'}</p>
        <p><strong>To:</strong> ${recipientList}</p>
        <p><strong>Subject:</strong> ${email.subject || '(No subject)'}</p>
        <hr />
        ${
          email.html ||
          `<pre>${email.text || 'No content available'}</pre>`
        }
      `,
    });

    if (sendError) {
      console.error(sendError);
      return new NextResponse(
        `Failed to forward email: ${sendError.message}`,
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('💥 Webhook error:', error);
    return new NextResponse('Internal server error', {
      status: 500,
    });
  }
}