// merge-clips is now done client-side via ffmpeg.wasm
// This route is kept as a stub so existing bookmarks return a clear error
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Server-side merge removed. Merge is now handled in the browser via ffmpeg.wasm.' },
    { status: 410 }
  );
}
