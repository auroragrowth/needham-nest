import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'

const colours = {
  forest: '#17443f',
  amber: '#e6a251',
  teal: '#43a9a0',
  sage: '#89ac9e',
  cream: '#f9f6ef',
  slate: '#6b7570',
}

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: colours.forest,
    backgroundColor: 'white',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colours.sage,
    paddingBottom: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  block: { width: '50%' },
  labelSm: { fontSize: 7, color: colours.teal, letterSpacing: 1 },
  employer: { fontSize: 11, fontWeight: 700, marginTop: 2 },
  addr: { fontSize: 8, color: colours.slate },
  slipNumber: { fontSize: 11, fontWeight: 700, marginTop: 2 },
  meta: { fontSize: 8, color: colours.slate },
  paid: { marginTop: 2, fontSize: 8, color: colours.teal, fontWeight: 700 },
  twoCol: { flexDirection: 'row', gap: 12, marginTop: 8 },
  col: { flex: 1 },
  section: { marginTop: 8 },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: colours.teal,
    letterSpacing: 1,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  rowBorder: {
    borderTopWidth: 0.5,
    borderTopColor: colours.sage,
    marginTop: 2,
    paddingTop: 2,
    fontWeight: 700,
  },
  netBox: {
    marginTop: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: colours.forest,
    backgroundColor: '#fdf2dc',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netLabel: { fontSize: 8, color: colours.teal, letterSpacing: 1 },
  netVal: { fontSize: 14, fontWeight: 700 },
  notes: { marginTop: 8, fontSize: 8, color: colours.slate },
  footer: {
    marginTop: 12,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: colours.sage,
    fontSize: 7,
    color: colours.slate,
  },
  bankLine: { fontSize: 8 },
  mono: { fontFamily: 'Courier' },
})

export type PdfPayslip = {
  id: string
  slip_number: string | null
  pay_date: string
  period_from: string
  period_to: string
  hours_worked: number
  gross_pay: number
  tax_deduction: number
  ni_deduction: number
  pension_deduction: number
  other_deductions: number
  other_deductions_label: string | null
  net_pay: number
  tax_code: string | null
  ni_category: string | null
  notes: string | null
  paid_at: string | null
  paid_method: string | null
}

export type PdfStaff = {
  name: string
  address_line_1: string | null
  address_line_2: string | null
  address_city: string | null
  address_postcode: string | null
  ni_number: string | null
  bank_sort_code: string | null
  bank_account_number: string | null
}

export type PdfEmployer = {
  company_name: string | null
  address: string | null
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function fmtMoney(n: number | string | null | undefined): string {
  if (n == null) return '£0.00'
  return `£${Number(n).toFixed(2)}`
}

export function PayslipDocument({
  payslip,
  staff,
  employer,
}: {
  payslip: PdfPayslip
  staff: PdfStaff
  employer: PdfEmployer
}) {
  const totalDeductions =
    Number(payslip.tax_deduction) +
    Number(payslip.ni_deduction) +
    Number(payslip.pension_deduction) +
    Number(payslip.other_deductions)
  const showBank = staff.bank_sort_code || staff.bank_account_number

  return (
    <Document title={`Payslip ${payslip.slip_number ?? ''} — ${staff.name}`}>
      <Page size="A5" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.block}>
            <Text style={styles.labelSm}>EMPLOYER</Text>
            <Text style={styles.employer}>
              {employer.company_name ?? 'The Needham Nest'}
            </Text>
            <Text style={styles.addr}>
              {employer.address ?? 'Unit 2, The Old Town Hall'}
            </Text>
          </View>
          <View style={[styles.block, { alignItems: 'flex-end' }]}>
            <Text style={styles.labelSm}>PAYSLIP</Text>
            {payslip.slip_number && (
              <Text style={[styles.slipNumber, styles.mono]}>
                {payslip.slip_number}
              </Text>
            )}
            <Text style={styles.meta}>
              Pay date {fmtDate(payslip.pay_date)}
            </Text>
            <Text style={styles.meta}>
              Period {fmtDate(payslip.period_from)} –{' '}
              {fmtDate(payslip.period_to)}
            </Text>
            {payslip.paid_at && (
              <Text style={styles.paid}>
                Paid {fmtDate(payslip.paid_at.slice(0, 10))}
                {payslip.paid_method ? ` via ${payslip.paid_method}` : ''}
              </Text>
            )}
          </View>
        </View>

        {/* Employee block */}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.labelSm}>EMPLOYEE</Text>
            <Text style={{ fontWeight: 700, marginTop: 2 }}>
              {staff.name}
            </Text>
            {(staff.address_line_1 ||
              staff.address_city ||
              staff.address_postcode) && (
              <Text style={styles.addr}>
                {[
                  staff.address_line_1,
                  staff.address_line_2,
                  staff.address_city,
                  staff.address_postcode,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            )}
          </View>
          <View style={[styles.col, { alignItems: 'flex-end' }]}>
            {payslip.tax_code && (
              <Text style={styles.bankLine}>
                Tax code: <Text style={styles.mono}>{payslip.tax_code}</Text>
              </Text>
            )}
            {payslip.ni_category && (
              <Text style={styles.bankLine}>
                NI category:{' '}
                <Text style={styles.mono}>{payslip.ni_category}</Text>
              </Text>
            )}
            {staff.ni_number && (
              <Text style={styles.bankLine}>
                NI number: <Text style={styles.mono}>{staff.ni_number}</Text>
              </Text>
            )}
            <Text style={styles.bankLine}>
              Hours:{' '}
              <Text style={styles.mono}>
                {Number(payslip.hours_worked).toFixed(2)}
              </Text>
            </Text>
            {showBank && (
              <>
                <Text style={styles.bankLine}>
                  Sort code:{' '}
                  <Text style={styles.mono}>
                    {staff.bank_sort_code ?? '—'}
                  </Text>
                </Text>
                <Text style={styles.bankLine}>
                  Account:{' '}
                  <Text style={styles.mono}>
                    {staff.bank_account_number ?? '—'}
                  </Text>
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Earnings + Deductions */}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>EARNINGS</Text>
            <View style={styles.row}>
              <Text>Gross pay</Text>
              <Text style={styles.mono}>{fmtMoney(payslip.gross_pay)}</Text>
            </View>
            <View style={[styles.row, styles.rowBorder]}>
              <Text>Total earnings</Text>
              <Text style={styles.mono}>{fmtMoney(payslip.gross_pay)}</Text>
            </View>
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>DEDUCTIONS</Text>
            <View style={styles.row}>
              <Text>Income tax</Text>
              <Text style={styles.mono}>
                {fmtMoney(payslip.tax_deduction)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text>National Insurance</Text>
              <Text style={styles.mono}>
                {fmtMoney(payslip.ni_deduction)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text>Pension</Text>
              <Text style={styles.mono}>
                {fmtMoney(payslip.pension_deduction)}
              </Text>
            </View>
            {Number(payslip.other_deductions) > 0 && (
              <View style={styles.row}>
                <Text>{payslip.other_deductions_label ?? 'Other'}</Text>
                <Text style={styles.mono}>
                  {fmtMoney(payslip.other_deductions)}
                </Text>
              </View>
            )}
            <View style={[styles.row, styles.rowBorder]}>
              <Text>Total deductions</Text>
              <Text style={styles.mono}>{fmtMoney(totalDeductions)}</Text>
            </View>
          </View>
        </View>

        {/* Net pay */}
        <View style={styles.netBox}>
          <Text style={styles.netLabel}>NET PAY THIS PERIOD</Text>
          <Text style={styles.netVal}>{fmtMoney(payslip.net_pay)}</Text>
        </View>

        {payslip.notes && <Text style={styles.notes}>{payslip.notes}</Text>}

        <Text style={styles.footer}>
          This is a payroll summary for record-keeping; the legal payslip
          is issued by your PAYE software.
        </Text>
      </Page>
    </Document>
  )
}
