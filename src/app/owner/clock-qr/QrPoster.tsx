import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'

const colours = {
  forest: '#17443f',
  amber: '#e6a251',
  cream: '#f9f6ef',
  sage: '#89ac9e',
  slate: '#6b7570',
  tealDeep: '#4d7d79',
  olive: '#3f5847',
}

// Same base-URL convention used elsewhere (see src/lib/sumup/config.ts).
export const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://needham-nest.vercel.app'

export const ACTIONS = [
  { label: 'CLOCK IN', action: 'clock-in', accent: colours.forest },
  { label: 'CLOCK OUT', action: 'clock-out', accent: colours.amber },
  { label: 'GO ON BREAK', action: 'break-start', accent: colours.tealDeep },
  { label: 'RETURN FROM BREAK', action: 'break-end', accent: colours.olive },
] as const

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: 'Helvetica',
    color: colours.forest,
    backgroundColor: colours.cream,
  },
  header: {
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: colours.forest,
  },
  brand: { fontSize: 20, fontWeight: 700, letterSpacing: 1 },
  title: { marginTop: 6, fontSize: 14, fontWeight: 700 },
  subtitle: { fontSize: 9, color: colours.slate, marginTop: 3 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colours.sage,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 10,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.6,
    marginBottom: 12,
    textAlign: 'center',
  },
  qr: { width: 210, height: 210 },
  hint: { marginTop: 12, fontSize: 9, color: colours.slate, textAlign: 'center' },

  footer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: colours.sage,
    fontSize: 9,
    color: colours.slate,
    textAlign: 'center',
  },
})

export function QrPoster({ qrByAction }: { qrByAction: Record<string, string> }) {
  const today = new Date().toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Document title="Needham Nest — Clock QR codes">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>NEEDHAM NEST</Text>
          <Text style={styles.title}>Clock in &amp; out — scan with your phone</Text>
          <Text style={styles.subtitle}>
            Sign in with your PIN once, then point your phone camera at the code
            for what you want to do. You&apos;ll get a single button to confirm.
          </Text>
        </View>

        <View style={styles.grid}>
          {ACTIONS.map((a) => (
            <View key={a.action} style={styles.card}>
              <Text style={[styles.cardLabel, { color: a.accent }]}>
                {a.label}
              </Text>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image style={styles.qr} src={qrByAction[a.action]} />
              <Text style={styles.hint}>Scan with your phone camera</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text>
            Generated {today} · codes point to {BASE_URL}/staff/clock
          </Text>
        </View>
      </Page>
    </Document>
  )
}
