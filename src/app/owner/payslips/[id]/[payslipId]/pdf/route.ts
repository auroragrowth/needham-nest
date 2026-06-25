import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { PayslipDocument } from '@/lib/payslips/pdf'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; payslipId: string }> },
) {
  const session = await getSession()
  if (
    !session ||
    (session.role !== 'owner' && session.role !== 'payroll')
  ) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { id, payslipId } = await context.params
  const admin = createAdminClient()
  const [{ data: payslip }, { data: staff }, { data: settings }] =
    await Promise.all([
      admin.from('payslips').select('*').eq('id', payslipId).maybeSingle(),
      admin
        .from('profiles')
        .select(
          'name, address_line_1, address_line_2, address_city, address_postcode, ni_number, bank_sort_code, bank_account_number',
        )
        .eq('id', id)
        .maybeSingle(),
      admin
        .from('settings')
        .select('company_name, address')
        .limit(1)
        .maybeSingle(),
    ])

  if (!payslip || !staff) {
    return new NextResponse('Not found', { status: 404 })
  }

  const buffer = await renderToBuffer(
    PayslipDocument({
      payslip,
      staff,
      employer: settings ?? { company_name: null, address: null },
    }),
  )

  const safeName = staff.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const slip = payslip.slip_number ?? payslip.pay_date
  const filename = `payslip-${slip}-${safeName}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
