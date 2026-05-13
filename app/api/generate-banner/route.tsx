import { ImageResponse } from 'next/og';
import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const subject = body.subject || '';

        // Generate the PNG using next/og
        // Split subject into two lines for the Canva design
        // Split subject into two lines for the Canva design
        let part1 = '';
        let part2 = '';
        if (subject.includes(':')) {
            const parts = subject.split(':');
            part1 = parts[0].trim() + ':';
            part2 = parts.slice(1).join(':').trim();
        } else {
            const words = subject.trim().split(/\s+/);
            const mid = Math.floor(words.length / 2);
            part1 = words.slice(0, mid).join(' ');
            part2 = words.slice(mid).join(' ');
        }

        const wordsPart1 = part1.split(/\s+/).filter(Boolean);
        const wordsPart2 = part2.split(/\s+/).filter(Boolean);

        const protocol = req.headers.get('x-forwarded-proto') || 'http';
        const host = req.headers.get('host') || 'localhost:3000';
        const bgUrl = `${protocol}://${host}/banner-bg.png`;

        const imageResponse = new ImageResponse(
            (
                <div style={{
                    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                    justifyContent: 'center', alignItems: 'flex-start',
                    padding: '0 100px',
                    fontFamily: 'sans-serif', position: 'relative', overflow: 'hidden',
                }}>
                    {/* Background Image from Canva */}
                    <img src={bgUrl} style={{ position: 'absolute', top: 0, left: 0, width: '1200px', height: '500px', objectFit: 'cover' }} />

                    {/* Dynamic Text Box Safe Area (Avoids logo on top right and pill on bottom left) */}
                    <div style={{ 
                        position: 'absolute', 
                        top: '80px', 
                        bottom: '160px', 
                        left: '170px', 
                        right: '100px',
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'center',
                        zIndex: 10 
                    }}>
                        {/* Part 1 */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 12 }}>
                            {wordsPart1.map((word: string, i: number) => (
                                <span key={`p1-${i}`} style={{ fontSize: 36, fontWeight: 400, color: 'white', letterSpacing: '0.02em', marginRight: 10 }}>
                                    {word}
                                </span>
                            ))}
                        </div>
                        {/* Part 2 */}
                        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                            {wordsPart2.map((word: string, i: number) => (
                                <span key={`p2-${i}`} style={{ fontSize: 56, fontWeight: 600, color: 'white', lineHeight: 1.2, letterSpacing: '-0.02em', textShadow: '0px 10px 20px rgba(0,0,0,0.2)', marginRight: 14 }}>
                                    {word}
                                </span>
                            ))}
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
