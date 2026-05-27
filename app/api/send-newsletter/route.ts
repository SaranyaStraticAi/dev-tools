// app/api/send-newsletter/route.ts
// Creates a Resend broadcast and sends it immediately to the audience.
// Returns { broadcastId, campaignId } so the client can poll for metrics.

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
    try {
        const { html, subject, segmentIds, type, scheduledAt } = await req.json() as {
            html: string;
            subject: string;
            segmentIds?: string[];
            type?: string;
            scheduledAt?: string;  // ISO 8601 or natural language e.g. "tomorrow at 9am"
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

        let finalBroadcastIds: string[] = [];

        // If segments are selected, we send via Resend Broadcasts API targeting the segment(s)
        if (segmentIds && segmentIds.length > 0) {
            console.log('[send-newsletter] segment sending selected:', segmentIds);

            const broadcastIds: string[] = [];
            for (const segId of segmentIds) {
                const payload: any = {
                    from: `${fromName} <${fromEmail}>`,
                    subject,
                    html,
                    name: `Newsletter — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
                    segmentId: segId,
                };

                console.log(`[send-newsletter] creating broadcast for segment ${segId} with payload:`, { ...payload, html: '...' });
                let createRes = await resend.broadcasts.create(payload);

                if (createRes.error) {
                    console.error('[send-newsletter] broadcast create error:', createRes.error);
                    return NextResponse.json({ error: createRes.error.message }, { status: 500 });
                }

                const broadcastId = createRes.data?.id;
                if (!broadcastId) {
                    return NextResponse.json({ error: 'No broadcastId returned from Resend' }, { status: 500 });
                }

                console.log(`[send-newsletter] sending broadcast ${broadcastId}${scheduledAt ? ` scheduled at ${scheduledAt}` : ''}`);
                const sendRes = await resend.broadcasts.send(broadcastId, {
                    ...(scheduledAt ? { scheduledAt } : {}),
                });

                if (sendRes.error) {
                    console.error('[send-newsletter] broadcast send error:', sendRes.error);
                    return NextResponse.json({ error: sendRes.error.message }, { status: 500 });
                }

                console.log(`[send-newsletter] ✅ Broadcast ${broadcastId} sent`);
                broadcastIds.push(broadcastId);
            }
            finalBroadcastIds = broadcastIds;
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
                return NextResponse.json({ error: createRes.error.message }, { status: 500 });
            }

            const broadcastId = createRes.data?.id;
            if (!broadcastId) {
                return NextResponse.json({ error: 'No broadcastId returned from Resend' }, { status: 500 });
            }

            // Step 2 — send immediately or scheduled
            console.log(`[send-newsletter] sending broadcast ${broadcastId}${scheduledAt ? ` scheduled at ${scheduledAt}` : ' immediately'}`);
            const sendRes = await resend.broadcasts.send(broadcastId, {
                ...(scheduledAt ? { scheduledAt } : {}),
            });

            if (sendRes.error) {
                console.error('[send-newsletter] send error:', sendRes.error);
                return NextResponse.json({ error: sendRes.error.message }, { status: 500 });
            }

            console.log(`[send-newsletter] ✅ Broadcast ${broadcastId} sent`);
            finalBroadcastIds = [broadcastId];
        }

        // Save campaign to DB
        let campaignId = null;
        try {
            const campaign = await prisma.email_campaigns.create({
                data: {
                    subject,
                    body: html,
                    type: type || 'weekly',
                    broadcast_ids: finalBroadcastIds,
                    segment_ids: segmentIds || [],
                    status: scheduledAt ? 'scheduled' : 'sent',
                    scheduled_at: scheduledAt ? new Date(scheduledAt) : null,
                } as any,
            });
            campaignId = campaign.id;
            console.log(`[send-newsletter] saved campaign ${campaignId} to DB`);
        } catch (dbErr) {
            console.error('[send-newsletter] database error saving campaign:', dbErr);
        }

        return NextResponse.json({
            broadcastId: finalBroadcastIds[0],
            campaignId,
            status: scheduledAt ? 'scheduled' : 'sent',
            scheduledAt: scheduledAt ?? null,
            count: finalBroadcastIds.length
        });
    } catch (err: any) {
        console.error('[send-newsletter] unexpected error:', err);
        return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
    }
}
