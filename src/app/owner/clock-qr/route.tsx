import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { getSession } from '@/lib/auth/session'
import { ACTIONS, BASE_URL, QrPoster } from './QrPoster'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  const session = await getSession()
  if (!session || (session.role !== 'owner' && session.role !== 'manager')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const qrByAction: Record<string, string> = {}
  for (const a of ACTIONS) {
    qrByAction[a.action] = await QRCode.toDataURL(
      `${BASE_URL}/staff/clock?action=${a.action}`,
      { margin: 1, width: 600, errorCorrectionLevel: 'M' },
    )
  }

  const buffer = await renderToBuffer(QrPoster({ qrByAction }))

  // ?download=1 saves the file; without it the poster opens in the browser's
  // PDF viewer, which is what you want on the iPad (view → share → print).
  const download = new URL(request.url).searchParams.get('download') === '1'

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${
        download ? 'attachment' : 'inline'
      }; filename="needham-nest-clock-qr.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
