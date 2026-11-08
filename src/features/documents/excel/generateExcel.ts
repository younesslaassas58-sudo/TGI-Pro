import ExcelJS from 'exceljs'
import { numberToFrenchWords } from '@/lib/format'
import type { DocumentModel } from '../types'

function safeColor(value: string): string {
  return value.replace('#', '').toUpperCase()
}

export async function generateExcel(model: DocumentModel): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = model.issuer.tradeName
  workbook.subject = model.title
  workbook.created = new Date()
  if (model.type === 'fiche') {
    const sheet = workbook.addWorksheet('Fiche', {
      pageSetup: { paperSize: 9, orientation: model.options.orientation, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      views: [{ state: 'frozen', ySplit: 4 }],
    })
    sheet.columns = Array.from({ length: 8 }, () => ({ width: 22 }))
    sheet.mergeCells('A1:H1')
    sheet.getCell('A1').value = model.issuer.tradeName
    sheet.getCell('A1').font = { name: 'Arial', size: 18, bold: true, color: { argb: safeColor(model.issuer.documentAppearance.primaryColor) } }
    sheet.mergeCells('A2:H2')
    sheet.getCell('A2').value = `${model.title} · ${model.number} · ${model.date}`
    sheet.getCell('A2').font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: safeColor(model.issuer.documentAppearance.primaryColor) } }
    sheet.mergeCells('A3:H3')
    sheet.getCell('A3').value = [model.recipient.name, model.recipient.address, model.recipient.city, model.recipient.phone, model.recipient.email].filter(Boolean).join(' · ')
    let rowIndex = 5
    for (const section of model.sections) {
      sheet.mergeCells(rowIndex, 1, rowIndex, 8)
      const sectionTitle = sheet.getCell(rowIndex, 1)
      sectionTitle.value = section.title
      sectionTitle.font = { name: 'Arial', bold: true, color: { argb: safeColor(model.issuer.documentAppearance.primaryColor) } }
      rowIndex += 1
      if (section.imageData) {
        const base64 = section.imageData.split(',')[1]
        if (base64) {
          const imageId = workbook.addImage({ base64, extension: 'jpeg' })
          sheet.addImage(imageId, { tl: { col: 0, row: rowIndex - 1 }, ext: { width: 110, height: 110 } })
          rowIndex += 8
        }
      }
      if (section.kind === 'fields' && section.fields) {
        for (let index = 0; index < section.fields.length; index += 2) {
          const left = section.fields[index]
          const right = section.fields[index + 1]
          if (left) {
            sheet.getCell(rowIndex, 1).value = left.label
            sheet.getCell(rowIndex, 2).value = left.value
          }
          if (right) {
            sheet.getCell(rowIndex, 5).value = right.label
            sheet.getCell(rowIndex, 6).value = right.value
          }
          rowIndex += 1
        }
      }
      if (section.kind === 'table' && section.table) {
        sheet.getRow(rowIndex).values = section.table.columns
        const header = sheet.getRow(rowIndex)
        header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: safeColor(model.issuer.documentAppearance.primaryColor) } }
        rowIndex += 1
        for (const values of section.table.rows) {
          sheet.getRow(rowIndex).values = values
          sheet.getRow(rowIndex).alignment = { vertical: 'top', wrapText: true }
          rowIndex += 1
        }
      }
      if (section.kind === 'checklist' && section.checks) {
        for (const check of section.checks) {
          sheet.mergeCells(rowIndex, 1, rowIndex, 8)
          sheet.getCell(rowIndex, 1).value = `${check.checked ? '[X]' : '[ ]'} ${check.label}`
          rowIndex += 1
        }
      }
      if (section.content) {
        sheet.mergeCells(rowIndex, 1, rowIndex, 8)
        sheet.getCell(rowIndex, 1).value = section.content
        sheet.getCell(rowIndex, 1).alignment = { wrapText: true, vertical: 'top' }
        rowIndex += 1
      }
      rowIndex += 1
    }
    const legalLines = [
      model.options.showLegalMentions ? model.issuer.legalMentions : '',
      [
        model.issuer.ice && `ICE ${model.issuer.ice}`,
        model.issuer.rc && `RC ${model.issuer.rc}`,
        model.issuer.taxId && `IF ${model.issuer.taxId}`,
        model.issuer.patente && `Patente ${model.issuer.patente}`,
        model.issuer.cnss && `CNSS ${model.issuer.cnss}`,
        model.options.showBankDetails && model.issuer.bankAccounts.find((account) => account.isDefault)?.rib,
      ].filter(Boolean).join(' · '),
    ].filter(Boolean)
    if (legalLines.length) {
      sheet.mergeCells(rowIndex, 1, rowIndex, 8)
      sheet.getCell(rowIndex, 1).value = legalLines.join(' · ')
      sheet.getCell(rowIndex, 1).font = { name: 'Arial', size: 8, color: { argb: 'FF64748B' } }
    }
    sheet.pageSetup.printArea = `A1:H${Math.max(4, rowIndex)}`
    sheet.headerFooter.oddFooter = '&L&"Arial,Regular"&8TGI Ascenseurs&CPage &P / &N'
    const buffer = await workbook.xlsx.writeBuffer()
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  }
  const sheet = workbook.addWorksheet('Document', {
    pageSetup: {
      paperSize: 9,
      orientation: model.options.orientation,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalDpi: 300,
      verticalDpi: 300,
      margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
    views: [{ state: 'frozen', ySplit: 7 }],
  })

  sheet.columns = [
    { key: 'designation', width: 36 },
    { key: 'description', width: 48 },
    { key: 'quantity', width: 10 },
    { key: 'unit', width: 12 },
    { key: 'price', width: 16 },
    { key: 'discount', width: 12 },
    { key: 'vat', width: 10 },
    { key: 'lineTotal', width: 18 },
  ]

  sheet.mergeCells('A1:H1')
  sheet.getCell('A1').value = model.issuer.tradeName
  sheet.getCell('A1').font = { name: 'Arial', size: 18, bold: true, color: { argb: safeColor(model.issuer.documentAppearance.primaryColor) } }
  sheet.getCell('A2').value = model.issuer.legalName
  sheet.mergeCells('A2:H2')
  sheet.getCell('A3').value = [model.issuer.address, model.issuer.city, model.issuer.phones.filter(Boolean).join(' · '), model.issuer.email].filter(Boolean).join(' · ')
  sheet.mergeCells('A3:H3')
  sheet.getCell('A4').value = `${model.title} · ${model.number} · ${model.date}`
  sheet.mergeCells('A4:H4')
  sheet.getCell('A4').font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: safeColor(model.issuer.documentAppearance.primaryColor) } }
  sheet.getCell('A5').value = `Destinataire : ${model.recipient.name}`
  sheet.mergeCells('A5:H5')
  sheet.getCell('A6').value = [model.recipient.address, model.recipient.city, model.recipient.ice && `ICE ${model.recipient.ice}`, model.recipient.phone, model.recipient.email].filter(Boolean).join(' · ')
  sheet.mergeCells('A6:H6')
  sheet.getRow(7).values = ['Désignation', 'Description', 'Quantité', 'Unité', 'Prix unitaire HT', 'Remise %', 'TVA %', 'Total ligne HT']

  const header = sheet.getRow(7)
  header.height = 26
  header.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: safeColor(model.issuer.documentAppearance.primaryColor) } }
  header.alignment = { vertical: 'middle', wrapText: true }

  const firstLineRow = 8
  model.lines.forEach((line, index) => {
    const rowNumber = firstLineRow + index
    const row = sheet.getRow(rowNumber)
    row.values = [
      line.designation,
      line.description,
      line.quantity,
      line.unit,
      line.unitPriceHT,
      line.discountPercent,
      line.vatPercent,
      {
        formula: `ROUND(ROUND(C${rowNumber}*E${rowNumber},2)-ROUND(ROUND(C${rowNumber}*E${rowNumber},2)*F${rowNumber}/100,2),2)`,
      },
    ]
    row.height = 38
    row.alignment = { vertical: 'top', wrapText: true }
    if (index % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      })
    }
    row.getCell(5).numFmt = '#,##0.00 "MAD"'
    row.getCell(8).numFmt = '#,##0.00 "MAD"'
    row.getCell(6).numFmt = '0.00"%"'
    row.getCell(7).numFmt = '0.00"%"'
  })

  const lastLineRow = Math.max(firstLineRow, firstLineRow + model.lines.length - 1)
  const summaryStart = lastLineRow + 2
  const moneyFormat = '#,##0.00 "MAD"'
  const sumRange = `H${firstLineRow}:H${lastLineRow}`
  const grossFormula = `SUMPRODUCT(ROUND(C${firstLineRow}:C${lastLineRow}*E${firstLineRow}:E${lastLineRow},2))`
  const discountsFormula = `${grossFormula}-SUM(${sumRange})`
  const summary: Array<[string, ExcelJS.CellValue]> = [
    ['Sous-total HT', { formula: `ROUND(${grossFormula},2)` }],
    ['Remises', { formula: `ROUND(${discountsFormula},2)` }],
    ['Total HT', { formula: `ROUND(SUM(${sumRange}),2)` }],
  ]

  const vatRates = [...new Set(model.lines.map((line) => line.vatPercent))].sort((a, b) => a - b)
  for (const rate of vatRates) {
    summary.push([
      `TVA ${rate} %`,
      { formula: `ROUND(SUMPRODUCT((G${firstLineRow}:G${lastLineRow}=${rate})*H${firstLineRow}:H${lastLineRow})*${rate}/100,2)` },
    ])
  }
  summary.push(['Total TTC', { formula: `${summaryStart + summary.length}B` }])
  const ttcRow = summaryStart + summary.length - 1
  const htRow = summaryStart + 2
  const vatFirstRow = summaryStart + 3
  summary[summary.length - 1] = [
    'Total TTC',
    { formula: `B${htRow}+SUM(B${vatFirstRow}:B${ttcRow - 1})` },
  ]

  summary.forEach(([label, value], index) => {
    const row = sheet.getRow(summaryStart + index)
    row.getCell(7).value = label
    row.getCell(8).value = value
    row.getCell(8).numFmt = moneyFormat
    row.getCell(7).font = { name: 'Arial', size: 10, bold: index === summary.length - 1 }
    row.getCell(8).font = { name: 'Arial', size: 10, bold: index === summary.length - 1 }
    if (index === summary.length - 1) {
      row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: safeColor(model.issuer.documentAppearance.primaryColor) } }
      row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: safeColor(model.issuer.documentAppearance.primaryColor) } }
      row.getCell(7).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      row.getCell(8).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    }
  })

  const finalRow = summaryStart + summary.length + 2
  if (model.options.showAmountInWords) {
    sheet.mergeCells(`A${finalRow}:H${finalRow}`)
    sheet.getCell(`A${finalRow}`).value =
      `Arrêté le présent document à la somme de : ${numberToFrenchWords(model.totals.totalTTC)}`
    sheet.getCell(`A${finalRow}`).font = { italic: true, color: { argb: 'FF64748B' } }
  }
  sheet.autoFilter = { from: { row: 7, column: 1 }, to: { row: lastLineRow, column: 8 } }
  sheet.pageSetup.printArea = `A1:H${finalRow}`
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.font = { name: 'Arial', ...cell.font }
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
