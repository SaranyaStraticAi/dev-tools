// app/api/send-newsletter/route.ts
// Creates a Resend broadcast and sends it immediately to the audience.
// Returns { broadcastId } so the client can poll for metrics.

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
    try {
        const { html, subject, segmentIds } = await req.json() as {
            html: string;
            subject: string;
            segmentIds?: string[];
        };

        if (!html || !subject) {
            return NextResponse.json({ error: 'html and subject are required' }, { status: 400 });
        }

        const audienceId = process.env.RESEND_AUDIENCE_ID;
        const fromEmail  = process.env.RESEND_FROM_EMAIL  ?? 'newsletter@example.com';
        const fromName   = process.env.RESEND_FROM_NAME   ?? 'Vibe Trader';

        if (!audienceId) {
            return NextResponse.json({ error: 'RESEND_AUDIENCE_ID not set in env' }, { status: 500 });
        }

        // If multiple segments are selected, we fetch contacts and send via emails.send with bcc
        if (segmentIds && segmentIds.length > 0) {
            console.log('[send-newsletter] multiple segments selected:', segmentIds);
            
            let allEmails: string[] = [];
            for (const segId of segmentIds) {
                const response = await fetch(`https://api.resend.com/segments/${segId}/contacts`, {
                    headers: {
                        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                    }
                });
                const data = await response.json();
                if (response.ok && data.data) {
                    allEmails.push(...data.data.map((c: any) => c.email));
                }
            }
            
            // Deduplicate
            const uniqueEmails = Array.from(new Set(allEmails));
            
            if (uniqueEmails.length === 0) {
                return NextResponse.json({ error: 'No contacts found in selected segments' }, { status: 400 });
            }
            
            console.log(`[send-newsletter] sending to ${uniqueEmails.length} unique contacts via bcc`);
            
            // Send via emails.send with bcc
            const sendRes = await resend.emails.send({
                from: `${fromName} <${fromEmail}>`,
                to: fromEmail, // Send to sender, recipients in bcc
                bcc: uniqueEmails,
                subject,
                html,
            });
            
            if (sendRes.error) {
                return NextResponse.json({ error: sendRes.error.message }, { status: 500 });
            }
            
            return NextResponse.json({ broadcastId: 'emails-send', status: 'sent', count: uniqueEmails.length });
        } else {
            // Fallback to single audience/broadcast
            const payload: any = {
                from: `${fromName} <${fromEmail}>`,
                subject,
                html,
                name: `Newsletter — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
                audienceId,
            };

            console.log('[send-newsletter] creating broadcast with payload:', { ...payload, html: '...' });
            let createRes = await resend.broadcasts.create(payload);

            if (createRes.error) {
                console.error('[send-newsletter] create error:', createRes.error);
                
                // SPECIAL FALLBACK: If we are blocked because of the test domain, 
                // send a SINGLE email to the sender for testing purposes.
                if (createRes.error.message.includes('resend.dev') || createRes.error.message.includes('verified domain')) {
                    console.log('[send-newsletter] 🔄 Falling back to Single Email Send for testing...');
                    
                    const toEmail = process.env.NEXT_PUBLIC_ALLOWED_EMAILS?.split(',')[0] || 'your-email@example.com';
                    const testSend = await resend.emails.send({
                        from: `${fromName} <${fromEmail}>`,
                        to:   toEmail,
                        subject: `[TEST] ${subject}`,
                        html,
                    });

                    if (testSend.error) {
                        return NextResponse.json({ error: `Fallback failed: ${testSend.error.message}` }, { status: 500 });
                    }

                    return NextResponse.json({ broadcastId: 'test-mode', status: 'sent', note: `Sent as individual test email to ${toEmail}` });
                }

                return NextResponse.json({ error: createRes.error.message }, { status: 500 });
            }

            const broadcastId = createRes.data?.id;
            if (!broadcastId) {
                return NextResponse.json({ error: 'No broadcastId returned from Resend' }, { status: 500 });
            }

            // Step 2 — send immediately
            const sendRes = await resend.broadcasts.send(broadcastId);

            if (sendRes.error) {
                console.error('[send-newsletter] send error:', sendRes.error);
                return NextResponse.json({ error: sendRes.error.message }, { status: 500 });
            }

            console.log(`[send-newsletter] ✅ Broadcast ${broadcastId} sent`);
            return NextResponse.json({ broadcastId, status: 'sent' });
        }
    } catch (err: any) {
        console.error('[send-newsletter] unexpected error:', err);
        return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
    }
}
