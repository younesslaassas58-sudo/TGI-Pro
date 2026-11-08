import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { DocumentModel } from '../types'
import { formatDate, formatMoney, formatPercent, numberToFrenchWords } from '@/lib/format'

function cleanColor(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#C9A227'
}

function companyLines(model: DocumentModel): string[] {
  return [
    model.issuer.legalName,
    model.issuer.address,
    [model.issuer.postalCode, model.issuer.city, model.issuer.country].filter(Boolean).join(' '),
    model.issuer.phones.filter(Boolean).join(' · '),
    model.issuer.email,
    model.issuer.website,
  ].filter(Boolean)
}

function legalFooter(model: DocumentModel): string[] {
  const company = model.issuer
  const ids = [
    company.ice && `ICE ${company.ice}`,
    company.rc && `RC ${company.rc}${company.tribunal ? ` · ${company.tribunal}` : ''}`,
    company.taxId && `IF ${company.taxId}`,
    company.patente && `Patente ${company.patente}`,
    company.cnss && `CNSS ${company.cnss}`,
  ].filter(Boolean)
  const account = company.bankAccounts.find((bank) => bank.isDefault)
  if (model.options.showBankDetails && account) ids.push(`${account.bank} · RIB ${account.rib}`)
  if (model.options.showLegalMentions && company.legalMentions) ids.push(company.legalMentions)
  return ids
}

export function PdfDocument({ model }: { model: DocumentModel }) {
  const primary = cleanColor(model.issuer.documentAppearance.primaryColor)
  const accent = cleanColor(model.options.accentColor)
  const horizontal = model.options.orientation === 'landscape'

  const styles = StyleSheet.create({
    page: {
      paddingTop: 32,
      paddingHorizontal: 36,
      paddingBottom: 52,
      fontFamily: model.issuer.documentAppearance.font,
      fontSize: 8,
      color: '#334155',
      backgroundColor: '#ffffff',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      borderBottomWidth: 2,
      borderBottomColor: accent,
      paddingBottom: 12,
      marginBottom: 18,
    },
    company: { flexDirection: 'row', gap: 12, maxWidth: '67%' },
    logo: { width: 82, height: 48, objectFit: 'contain' },
    companyInfo: { flex: 1 },
    tradeName: { fontSize: 12, fontWeight: 700, color: primary, marginBottom: 3 },
    companyLine: { fontSize: 7, lineHeight: 1.4, color: '#64748b' },
    docBox: {
      padding: 10,
      backgroundColor: primary,
      minWidth: 130,
      borderRadius: 4,
      alignItems: 'flex-end',
    },
    docType: { color: '#ffffff', fontSize: 8, textTransform: 'uppercase', marginBottom: 4 },
    docNumber: { color: '#ffffff', fontSize: 11, fontWeight: 700 },
    docDate: { color: '#dbe4ef', fontSize: 7, marginTop: 4 },
    title: { color: primary, fontSize: 15, fontWeight: 700, marginBottom: 4 },
    reference: { color: '#64748b', fontSize: 8, marginBottom: 14 },
    recipientRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
    recipientBox: {
      width: '48%',
      padding: 10,
      borderWidth: 0.6,
      borderColor: '#e2e8f0',
      borderRadius: 4,
      minHeight: 62,
    },
    smallLabel: { fontSize: 7, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 },
    recipientName: { color: primary, fontSize: 9, fontWeight: 700, marginBottom: 3 },
    bodyText: { fontSize: 7.5, lineHeight: 1.45, color: '#475569' },
    table: { width: '100%', marginBottom: 14 },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: primary,
      color: '#ffffff',
      paddingVertical: 7,
      paddingHorizontal: 5,
      borderRadius: 2,
    },
    tableHeaderText: { color: '#ffffff', fontSize: 7, fontWeight: 700 },
    row: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 5 },
    rowAlt: { backgroundColor: '#f8fafc' },
    cell: { fontSize: 7, lineHeight: 1.35, paddingRight: 4 },
    desc: { width: horizontal ? '39%' : '34%' },
    qty: { width: '8%', textAlign: 'right' },
    unit: { width: '9%', textAlign: 'center' },
    price: { width: '15%', textAlign: 'right' },
    discount: { width: '8%', textAlign: 'right' },
    vat: { width: '8%', textAlign: 'right' },
    total: { width: '18%', textAlign: 'right' },
    lineTitle: { fontSize: 7.5, color: '#0f172a', fontWeight: 700, marginBottom: 2 },
    totals: { width: 210, alignSelf: 'flex-end', marginTop: 2 },
    totalLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    totalLabel: { fontSize: 8, color: '#64748b' },
    totalValue: { fontSize: 8, color: '#334155' },
    grandTotal: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 3,
      padding: 8,
      backgroundColor: primary,
      borderRadius: 3,
    },
    grandLabel: { color: '#ffffff', fontSize: 9, fontWeight: 700 },
    grandValue: { color: '#ffffff', fontSize: 10, fontWeight: 700 },
    words: { marginTop: 10, fontSize: 7.5, lineHeight: 1.4, color: '#475569' },
    section: { marginTop: 13 },
    sectionTitle: { color: primary, fontSize: 8, fontWeight: 700, marginBottom: 4 },
    note: { marginTop: 12, padding: 8, backgroundColor: '#f8fafc', borderRadius: 3 },
    signatures: { flexDirection: 'row', justifyContent: 'flex-end', gap: 30, marginTop: 18 },
    signatureBlock: { width: 100, alignItems: 'center' },
    signatureImage: { width: 90, height: 48, objectFit: 'contain' },
    stampImage: { width: 74, height: 60, objectFit: 'contain' },
    signatureLabel: { fontSize: 7, color: '#64748b', marginTop: 3 },
    footer: {
      position: 'absolute',
      left: 36,
      right: 36,
      bottom: 20,
      borderTopWidth: 0.6,
      borderTopColor: '#dbe2ea',
      paddingTop: 6,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    footerText: { fontSize: 6, color: '#64748b', lineHeight: 1.35, maxWidth: '82%' },
    pageNumber: { fontSize: 7, color: '#64748b' },
    watermark: {
      position: 'absolute',
      top: horizontal ? 255 : 310,
      left: 90,
      right: 90,
      textAlign: 'center',
      color: '#cbd5e1',
      opacity: 0.25,
      fontSize: 52,
      fontWeight: 700,
      transform: 'rotate(-32deg)',
    },
    fichaGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: '#e2e8f0' },
    fichaPair: { width: '50%', minHeight: 28, padding: 6, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#e2e8f0' },
    fichaLabel: { fontSize: 6.5, color: '#64748b', marginBottom: 3 },
    fichaValue: { fontSize: 8, color: '#1e293b' },
    fichaTableHeader: { flexDirection: 'row', backgroundColor: primary, padding: 6 },
    fichaTableRow: { flexDirection: 'row', padding: 6, borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0' },
    fichaTableCell: { flex: 1, fontSize: 7, paddingRight: 4 },
  })

  const issuerLines = companyLines(model)
  const footerLines = legalFooter(model)
  const bank = model.issuer.bankAccounts.find((account) => account.isDefault)
  const logoAlign = model.issuer.documentAppearance.headerLogoPosition
  const companyContent = (
    <>
      {model.options.showLogo && model.issuer.images.logo && (
        <Image src={model.issuer.images.logo} style={styles.logo} />
      )}
      <View style={styles.companyInfo}>
        <Text style={styles.tradeName}>{model.issuer.tradeName}</Text>
        {model.options.showSlogan && model.issuer.slogan && (
          <Text style={styles.companyLine}>{model.issuer.slogan}</Text>
        )}
        {issuerLines.map((line, index) => (
          <Text key={`${index}-${line}`} style={styles.companyLine}>
            {line}
          </Text>
        ))}
      </View>
    </>
  )

  return (
    <Document title={`${model.number} - ${model.recipient.name}`} author={model.issuer.tradeName}>
      <Page size="A4" orientation={horizontal ? 'landscape' : 'portrait'} style={styles.page} wrap>
        {model.options.showWatermark && <Text style={styles.watermark}>BROUILLON</Text>}
        <View style={styles.header}>
          <View style={[styles.company, { flexDirection: logoAlign === 'droite' ? 'row-reverse' : 'row' }]}>
            {companyContent}
          </View>
          <View style={styles.docBox}>
            <Text style={styles.docType}>{model.title || model.type}</Text>
            <Text style={styles.docNumber}>{model.number}</Text>
            <Text style={styles.docDate}>{formatDate(model.date)}</Text>
          </View>
        </View>

        <Text style={styles.title}>{model.title}</Text>
        {model.references && <Text style={styles.reference}>{model.references}</Text>}

        <View style={styles.recipientRow}>
          <View style={styles.recipientBox}>
            <Text style={styles.smallLabel}>Destinataire</Text>
            <Text style={styles.recipientName}>{model.recipient.name}</Text>
            {[model.recipient.address, model.recipient.city, model.recipient.ice && `ICE : ${model.recipient.ice}`, model.recipient.phone, model.recipient.email]
              .filter(Boolean)
              .map((line, index) => (
                <Text key={`${index}-${line}`} style={styles.bodyText}>
                  {line}
                </Text>
              ))}
          </View>
          <View style={styles.recipientBox}>
            <Text style={styles.smallLabel}>Informations</Text>
            <Text style={styles.bodyText}>Date : {formatDate(model.date)}</Text>
            {model.paymentMethod && <Text style={styles.bodyText}>Règlement : {model.paymentMethod}</Text>}
            {model.deliveryTime && <Text style={styles.bodyText}>Délai : {model.deliveryTime}</Text>}
          </View>
        </View>

        {model.type !== 'fiche' && <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.tableHeaderText, styles.desc]}>Désignation</Text>
            <Text style={[styles.tableHeaderText, styles.qty]}>Qté</Text>
            <Text style={[styles.tableHeaderText, styles.unit]}>Unité</Text>
            <Text style={[styles.tableHeaderText, styles.price]}>PU HT</Text>
            <Text style={[styles.tableHeaderText, styles.discount]}>Rem.</Text>
            <Text style={[styles.tableHeaderText, styles.vat]}>TVA</Text>
            <Text style={[styles.tableHeaderText, styles.total]}>Total HT</Text>
          </View>
          {model.lines.map((line, index) => {
            const gross = line.unitPriceHT * line.quantity
            const net = gross * (1 - line.discountPercent / 100)
            return (
              <View key={line.id} style={[styles.row, index % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
                <View style={styles.desc}>
                  <Text style={styles.lineTitle}>{line.designation}</Text>
                  {line.description && <Text style={styles.cell}>{line.description}</Text>}
                </View>
                <Text style={[styles.cell, styles.qty]}>{line.quantity}</Text>
                <Text style={[styles.cell, styles.unit]}>{line.unit}</Text>
                <Text style={[styles.cell, styles.price]}>{formatMoney(line.unitPriceHT)}</Text>
                <Text style={[styles.cell, styles.discount]}>{formatPercent(line.discountPercent)}</Text>
                <Text style={[styles.cell, styles.vat]}>{formatPercent(line.vatPercent)}</Text>
                <Text style={[styles.cell, styles.total]}>{formatMoney(net)}</Text>
              </View>
            )
          })}
        </View>}

        {model.type !== 'fiche' && <View style={styles.totals} wrap={false}>
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Sous-total HT</Text>
            <Text style={styles.totalValue}>{formatMoney(model.totals.subtotalHT)}</Text>
          </View>
          {model.totals.discounts > 0 && (
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Remises</Text>
              <Text style={styles.totalValue}>− {formatMoney(model.totals.discounts)}</Text>
            </View>
          )}
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValue}>{formatMoney(model.totals.totalHT)}</Text>
          </View>
          {model.totals.vatByRate.map((vat) => (
            <View key={vat.rate} style={styles.totalLine}>
              <Text style={styles.totalLabel}>TVA {formatPercent(vat.rate)}</Text>
              <Text style={styles.totalValue}>{formatMoney(vat.amount)}</Text>
            </View>
          ))}
          <View style={styles.grandTotal}>
            <Text style={styles.grandLabel}>Total TTC</Text>
            <Text style={styles.grandValue}>{formatMoney(model.totals.totalTTC)}</Text>
          </View>
        </View>}

        {model.type !== 'fiche' && model.options.showAmountInWords && (
          <Text style={styles.words}>
            Arrêté le présent document à la somme de : {numberToFrenchWords(model.totals.totalTTC)}.
          </Text>
        )}
        {model.type !== 'fiche' && model.notes && (
          <View style={styles.note}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.bodyText}>{model.notes}</Text>
          </View>
        )}
        {model.type !== 'fiche' && model.conditions && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Conditions</Text>
            <Text style={styles.bodyText}>{model.conditions}</Text>
          </View>
        )}
        {model.sections.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.kind === 'fields' && section.fields && (
              <View style={styles.fichaGrid}>
                {section.fields.map((field) => (
                  <View key={field.id} style={styles.fichaPair} wrap={false}>
                    <Text style={styles.fichaLabel}>{field.label}</Text>
                    <Text style={styles.fichaValue}>{field.value || '—'}</Text>
                  </View>
                ))}
              </View>
            )}
            {section.kind === 'table' && section.table && (
              <View wrap={false}>
                <View style={styles.fichaTableHeader}>
                  {section.table.columns.map((column, index) => (
                    <Text key={`${column}-${index}`} style={[styles.fichaTableCell, { color: '#fff', fontWeight: 700 }]}>{column}</Text>
                  ))}
                </View>
                {section.table.rows.map((row, rowIndex) => (
                  <View key={`${section.id}-row-${rowIndex}`} style={[styles.fichaTableRow, rowIndex % 2 ? styles.rowAlt : {}]} wrap={false}>
                    {section.table?.columns.map((_, columnIndex) => (
                      <Text key={`${rowIndex}-${columnIndex}`} style={styles.fichaTableCell}>{row[columnIndex] ?? ''}</Text>
                    ))}
                  </View>
                ))}
              </View>
            )}
            {section.kind === 'checklist' && section.checks?.map((check) => (
              <Text key={check.id} style={styles.bodyText}>{check.checked ? '[X]' : '[ ]'} {check.label}</Text>
            ))}
            {section.content && <Text style={styles.bodyText}>{section.content}</Text>}
          </View>
        ))}
        {(model.options.showStamp || model.options.showSignature) && (
          <View style={styles.signatures} wrap={false}>
            {model.options.showStamp && model.issuer.images.stamp && (
              <View style={styles.signatureBlock}>
                <Image src={model.issuer.images.stamp} style={styles.stampImage} />
                <Text style={styles.signatureLabel}>Cachet</Text>
              </View>
            )}
            {model.options.showSignature && model.issuer.images.signature && (
              <View style={styles.signatureBlock}>
                <Image src={model.issuer.images.signature} style={styles.signatureImage} />
                <Text style={styles.signatureLabel}>Signature</Text>
              </View>
            )}
          </View>
        )}
        {model.options.showBankDetails && bank && (
          <Text style={styles.words}>
            Coordonnées bancaires : {bank.bank} · RIB {bank.rib} {bank.iban ? `· IBAN ${bank.iban}` : ''}
          </Text>
        )}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{footerLines.join(' · ')}</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
