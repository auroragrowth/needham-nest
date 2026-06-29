import { NextResponse } from 'next/server'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { COMMON_ALLERGENS } from '@/lib/menu'

export const runtime = 'nodejs'
export const maxDuration = 60

const colours = {
  forest: '#17443f',
  amber: '#e6a251',
  cream: '#f9f6ef',
  sage: '#89ac9e',
  slate: '#6b7570',
}

const ALLERGEN_SHORT: Record<string, string> = {
  gluten: 'Gluten',
  crustaceans: 'Crust',
  eggs: 'Eggs',
  fish: 'Fish',
  peanuts: 'P-nut',
  soybeans: 'Soya',
  milk: 'Milk',
  nuts: 'Nuts',
  celery: 'Cel',
  mustard: 'Must',
  sesame: 'Ses',
  sulphites: 'Sulph',
  lupin: 'Lupin',
  molluscs: 'Moll',
}

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: colours.forest,
    backgroundColor: colours.cream,
  },
  header: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: colours.forest,
  },
  brand: { fontSize: 16, fontWeight: 700, letterSpacing: 1 },
  brandSub: { fontSize: 8, color: colours.slate },
  title: { marginTop: 4, fontSize: 12, fontWeight: 700 },
  subtitle: { fontSize: 8, color: colours.slate, marginTop: 2 },

  table: { borderWidth: 1, borderColor: colours.forest },
  headerRow: { flexDirection: 'row', backgroundColor: colours.forest },
  headerCell: {
    paddingVertical: 4,
    paddingHorizontal: 3,
    borderRightWidth: 0.5,
    borderRightColor: colours.cream,
  },
  headerText: {
    color: colours.cream,
    fontSize: 7,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  nameHeader: { width: 140 },
  catHeader: { width: 80 },
  allergenHeader: { width: 30, textAlign: 'center' },

  row: {
    flexDirection: 'row',
    borderTopWidth: 0.4,
    borderTopColor: colours.sage,
    minHeight: 16,
  },
  rowEven: { backgroundColor: '#ffffff' },
  rowOdd: { backgroundColor: colours.cream },
  nameCell: {
    width: 140,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRightWidth: 0.4,
    borderRightColor: colours.sage,
    justifyContent: 'center',
  },
  catCell: {
    width: 80,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRightWidth: 0.4,
    borderRightColor: colours.sage,
    justifyContent: 'center',
    fontSize: 7,
    color: colours.slate,
  },
  allergenCell: {
    width: 30,
    paddingVertical: 3,
    borderRightWidth: 0.4,
    borderRightColor: colours.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allergenMark: {
    fontSize: 10,
    fontWeight: 700,
    color: colours.amber,
  },
  itemName: { fontSize: 8, fontWeight: 700 },

  footer: {
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 0.4,
    borderTopColor: colours.sage,
    fontSize: 7,
    color: colours.slate,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})

type Item = {
  name: string
  category: string | null
  allergens: string[] | null
}

function AllergenDocument({ items }: { items: Item[] }) {
  const today = new Date().toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Document title="Needham Nest — Allergen Matrix">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>NEEDHAM NEST</Text>
          <Text style={styles.brandSub}>Unit 2, The Old Town Hall · Allergen matrix</Text>
          <Text style={styles.title}>Menu allergens — by item</Text>
          <Text style={styles.subtitle}>
            Generated {today} · keep this with the till as required by UK Food
            Information Regulations 2014. Always confirm severe allergies with
            the kitchen.
          </Text>
        </View>

        <View style={styles.table}>
          {/* Column headers */}
          <View style={styles.headerRow}>
            <View style={[styles.headerCell, styles.nameHeader]}>
              <Text style={styles.headerText}>Item</Text>
            </View>
            <View style={[styles.headerCell, styles.catHeader]}>
              <Text style={styles.headerText}>Category</Text>
            </View>
            {COMMON_ALLERGENS.map((a) => (
              <View key={a} style={[styles.headerCell, styles.allergenHeader]}>
                <Text style={styles.headerText}>{ALLERGEN_SHORT[a] ?? a}</Text>
              </View>
            ))}
          </View>

          {/* Item rows */}
          {items.map((item, i) => (
            <View
              key={`${item.name}-${i}`}
              style={[styles.row, i % 2 === 0 ? styles.rowEven : styles.rowOdd]}
              wrap={false}
            >
              <View style={styles.nameCell}>
                <Text style={styles.itemName}>{item.name}</Text>
              </View>
              <View style={styles.catCell}>
                <Text>{item.category ?? '—'}</Text>
              </View>
              {COMMON_ALLERGENS.map((a) => (
                <View key={a} style={styles.allergenCell}>
                  {(item.allergens ?? []).includes(a) && (
                    <Text style={styles.allergenMark}>●</Text>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text>The 14 UK statutory allergens — ● = present</Text>
          <Text>Confirm cross-contamination risk with kitchen</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function GET() {
  const session = await getSession()
  if (!session || (session.role !== 'owner' && session.role !== 'manager')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const { data: items } = await admin
    .from('menu_items')
    .select('name, category, allergens')
    .eq('active', true)
    .order('category')
    .order('name')

  const buffer = await renderToBuffer(
    AllergenDocument({ items: (items ?? []) as Item[] }),
  )

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition':
        'inline; filename="needham-nest-allergens.pdf"',
      'Cache-Control': 'no-store',
    },
  })
}
