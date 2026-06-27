import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import { getSession } from '@/lib/auth/session'

export const runtime = 'nodejs'
export const maxDuration = 60

const colours = {
  forest: '#17443f',
  amber: '#e6a251',
  sage: '#89ac9e',
  cream: '#f9f6ef',
  teal: '#43a9a0',
  slate: '#6b7570',
}

const ROLES = [
  { name: 'Day Opener', time: '07:30 – 15:00' },
  { name: 'Cook', time: '09:30 – 15:00' },
  { name: 'FOH / Run / Pot', time: '11:00 – 16:45' },
]

const DAYS = [
  { label: 'Mon 29 Jun', staff: ['Vic', 'Anita', 'Crystal'] },
  { label: 'Tue 30 Jun', staff: ['Vic', 'Anita', 'Crystal'] },
  { label: 'Wed 1 Jul', staff: ['May', 'Vic', 'Deacon'] },
  { label: 'Thu 2 Jul', staff: ['Vic', 'Anita', 'Deacon'] },
  { label: 'Fri 3 Jul', staff: ['Crystal', 'Anita', 'May'] },
  { label: 'Sat 4 Jul', staff: ['Crystal', 'Anita', 'Taylor'] },
  { label: 'Sun 5 Jul', staff: ['Taylor', 'Vic', 'Deacon'] },
]

// Deterministic-ish colour per staff so each name reads consistently down
// the week — same palette concept as the in-app rota.
const STAFF_COLOURS: Record<string, string> = {
  Vic: '#a9d3cd',
  Anita: '#f5d7b5',
  Crystal: '#dcc7e9',
  May: '#f4b8b5',
  Deacon: '#b7d4f0',
  Taylor: '#e6e0b8',
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: colours.forest,
    backgroundColor: colours.cream,
  },
  header: {
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: colours.forest,
  },
  brandRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  brand: {
    fontSize: 18,
    fontWeight: 700,
    color: colours.forest,
    letterSpacing: 1,
  },
  brandSub: { fontSize: 9, color: colours.slate },
  title: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: 700,
  },
  subtitle: { marginTop: 2, fontSize: 9, color: colours.slate },
  // Table
  table: { marginTop: 4, borderWidth: 1, borderColor: colours.forest },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: colours.forest,
  },
  headerCell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: colours.cream,
  },
  dayHeaderCell: {
    width: 70,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: colours.cream,
  },
  headerText: {
    color: colours.cream,
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  headerTime: {
    color: colours.amber,
    fontSize: 8,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: colours.sage,
    minHeight: 56,
  },
  rowEven: { backgroundColor: '#ffffff' },
  rowOdd: { backgroundColor: colours.cream },
  dayCell: {
    width: 70,
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: colours.sage,
  },
  dayText: { fontSize: 9, fontWeight: 700, color: colours.forest },
  shiftCell: {
    flex: 1,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: colours.sage,
    justifyContent: 'center',
  },
  shiftCard: {
    backgroundColor: colours.sage,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 3,
    borderLeftWidth: 3,
    borderLeftColor: colours.forest,
  },
  shiftName: {
    fontSize: 11,
    fontWeight: 700,
    color: colours.forest,
  },
  shiftTime: {
    fontSize: 8,
    color: colours.forest,
    marginTop: 2,
  },
  // Footer
  footer: {
    marginTop: 14,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: colours.sage,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: colours.slate,
  },
})

function RotaDocument() {
  return (
    <Document title="Needham Nest — Weekly Rota Mockup">
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>NEEDHAM NEST</Text>
            <Text style={styles.brandSub}>· Unit 2, The Old Town Hall</Text>
          </View>
          <Text style={styles.title}>Weekly rota</Text>
          <Text style={styles.subtitle}>
            Mon 29 Jun – Sun 5 Jul 2026 · GMT · draft
          </Text>
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <View style={styles.dayHeaderCell}>
              <Text style={styles.headerText}>Day</Text>
            </View>
            {ROLES.map((r) => (
              <View key={r.name} style={styles.headerCell}>
                <Text style={styles.headerText}>{r.name}</Text>
                <Text style={styles.headerTime}>{r.time}</Text>
              </View>
            ))}
          </View>

          {/* Day rows */}
          {DAYS.map((d, i) => (
            <View
              key={d.label}
              style={[styles.row, i % 2 === 0 ? styles.rowEven : styles.rowOdd]}
            >
              <View style={styles.dayCell}>
                <Text style={styles.dayText}>{d.label}</Text>
              </View>
              {d.staff.map((person, idx) => (
                <View key={idx} style={styles.shiftCell}>
                  <View
                    style={[
                      styles.shiftCard,
                      {
                        backgroundColor:
                          STAFF_COLOURS[person] ?? colours.sage,
                        borderLeftColor: colours.forest,
                      },
                    ]}
                  >
                    <Text style={styles.shiftName}>{person}</Text>
                    <Text style={styles.shiftTime}>{ROLES[idx].time}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Generated by the Needham Nest staff system · GMT</Text>
          <Text>Draft — not yet published to staff</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'owner') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const buffer = await renderToBuffer(RotaDocument())

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition':
        'inline; filename="needham-nest-rota-mockup.pdf"',
      'Cache-Control': 'no-store',
    },
  })
}
