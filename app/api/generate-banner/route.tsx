import { ImageResponse } from 'next/og';
import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const subject = body.subject || '';

        // Generate the PNG using next/og
        const imageResponse = new ImageResponse(
            (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '60px 80px',
                        background: 'linear-gradient(to bottom right, #B8A4E8, #C084E8, #D870C0, #F472B6)',
                        fontFamily: 'Arial, sans-serif',
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                >
                    {/* Top right branding */}
                    <div style={{
                        position: 'absolute',
                        top: 50,
                        right: 80,
                        display: 'flex',
                        alignItems: 'center',
                    }}>
                        <span style={{ fontSize: 24, fontWeight: 300, color: 'rgba(255,255,255,0.95)', marginRight: 6 }}>vibe</span>
                        <span style={{ fontSize: 18, fontWeight: 700, color: 'white', marginRight: 4 }}>⚡</span>
                        <span style={{ fontSize: 32, fontWeight: 700, color: 'white' }}>trader</span>
                    </div>

                    {/* Main text */}
                    <div style={{ 
                        display: 'flex', 
                        marginTop: 100, 
                        width: '1040px',
                        fontSize: 60,
                        fontWeight: 700,
                        color: 'white',
                        lineHeight: 1.2,
                        flexWrap: 'wrap',
                    }}>
                        {subject}
                    </div>

                    {/* Bottom buttons */}
                    <div style={{ display: 'flex', marginTop: 'auto', marginBottom: 20 }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 262,
                            height: 52,
                            borderRadius: 26,
                            background: 'rgba(45,20,90,0.88)',
                            color: 'white',
                            fontSize: 17,
                            marginRight: 15,
                        }}>
                            Explore <span style={{ fontWeight: 700, marginLeft: 6 }}>Vibe Trader</span>
                        </div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 220,
                            height: 52,
                            borderRadius: 26,
                            background: 'rgba(255,255,255,0.15)',
                            border: '1.5px solid rgba(255,255,255,0.5)',
                            color: 'rgba(255,255,255,0.9)',
                            fontSize: 15,
                        }}>
                            vibetrader.com
                        </div>
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 500,
            }
        );

        // Convert the response to a buffer
        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Azure
        const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (!connStr) {
            throw new Error('Missing AZURE_STORAGE_CONNECTION_STRING');
        }

        const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
        const containerClient = blobServiceClient.getContainerClient('newsletter-assets');

        const blobName = `banner-${Date.now()}.png`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        await blockBlobClient.uploadData(buffer, {
            blobHTTPHeaders: { blobContentType: 'image/png' }
        });

        return NextResponse.json({ url: blockBlobClient.url });

    } catch (error: any) {
        console.error('Error generating banner:', error);
        return NextResponse.json({ error: error.message || 'Failed to generate banner' }, { status: 500 });
    }
}
