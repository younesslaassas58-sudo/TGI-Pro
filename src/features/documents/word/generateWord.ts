import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  PageNumber,
  Paragraph,
  Packer,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import type { DocumentModel } from '../types'
import { formatDate, formatMoney, formatPercent, numberToFrenchWords } from '@/lib/format'

function imageBytes(dataUrl: string): Uint8Array {
  const encoded = dataUrl.split(',')[1] ?? ''
  const binary = atob(encoded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function text(value: string, options: { bold?: boolean; color?: string; size?: number } = {}) {
  return new Paragraph({
    children: [
      new TextRun({
        text: value,
        bold: options.bold,
        color: options.color,
        size: options.size,
        font: 'Arial',
      }),
    ],
    spacing: { after: 70 },
  })
}

function cell(
  content: string,
  options: {
    header?: boolean
    align?: (typeof AlignmentType)[keyof typeof AlignmentType]
  } = {},
) {
  return new TableCell({
    shading: options.header ? { fill: '0B1F3A' } : undefined,
    margins: { top: 90, bottom: 90, left: 90, right: 90 },
    children: [
      new Paragraph({
        alignment: options.align ?? AlignmentType.LEFT,
        children: [
          new TextRun({
            text: content,
            bold: options.header,
            color: options.header ? 'FFFFFF' : '334155',
            size: 17,
            font: 'Arial',
          }),
        ],
      }),
    ],
  })
}

function cleanFileName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export async function generateWord(model: DocumentModel): Promise<Blob> {
  const primary = model.issuer.documentAppearance.primaryColor.replace('#', '')
  const accent = model.options.accentColor.replace('#', '')
  const headerCells = [
    new TableCell({
      width: { size: 55, type: WidthType.PERCENTAGE },
      borders: {
        bottom: { color: accent, size: 12, style: BorderStyle.SINGLE },
        top: { color: 'FFFFFF', size: 0, style: BorderStyle.NONE },
        left: { color: 'FFFFFF', size: 0, style: BorderStyle.NONE },
        right: { color: 'FFFFFF', size: 0, style: BorderStyle.NONE },
      },
      children: [
        ...(model.options.showLogo && model.issuer.images.logo
          ? [
              new Paragraph({
                children: [
                  new ImageRun({
                    type: 'png',
                    data: imageBytes(model.issuer.images.logo),
                    transformation: { width: 110, height: 48 },
                  }),
                ],
              }),
            ]
          : []),
        new Paragraph({
          children: [new TextRun({ text: model.issuer.tradeName, bold: true, color: primary, size: 24 })],
        }),
        ...(model.options.showSlogan && model.issuer.slogan ? [text(model.issuer.slogan)] : []),
        ...[
          model.issuer.legalName,
          model.issuer.address,
          [model.issuer.postalCode, model.issuer.city, model.issuer.country].filter(Boolean).join(' '),
          model.issuer.phones.filter(Boolean).join(' · '),
          model.issuer.email,
          model.issuer.website,
        ]
          .filter(Boolean)
          .map((line) => text(line)),
      ],
    }),
    new TableCell({
      width: { size: 45, type: WidthType.PERCENTAGE },
      shading: { fill: primary },
      margins: { top: 160, bottom: 160, left: 160, right: 160 },
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: model.title.toUpperCase(), color: 'FFFFFF', size: 18 })],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: model.number, bold: true, color: 'FFFFFF', size: 26 })],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: formatDate(model.date), color: 'DCE5EF', size: 16 })],
        }),
      ],
    }),
  ]

  const itemRows = model.lines.map(
    (line, index) =>
      new TableRow({
        cantSplit: true,
        children: [
          cell(`${line.designation}${line.description ? `\n${line.description}` : ''}`),
          cell(String(line.quantity), { align: AlignmentType.RIGHT }),
          cell(line.unit, { align: AlignmentType.CENTER }),
          cell(formatMoney(line.unitPriceHT), { align: AlignmentType.RIGHT }),
          cell(formatPercent(line.discountPercent), { align: AlignmentType.RIGHT }),
          cell(formatPercent(line.vatPercent), { align: AlignmentType.RIGHT }),
          cell(formatMoney(line.unitPriceHT * line.quantity * (1 - line.discountPercent / 100)), {
            align: AlignmentType.RIGHT,
          }),
        ],
        tableHeader: false,
        ...(index % 2 === 1 ? { cantSplit: true } : {}),
      }),
  )

  const recipient = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [5000, 5000],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              text('DESTINATAIRE', { color: '64748B', size: 14 }),
              text(model.recipient.name, { bold: true, color: primary, size: 19 }),
              ...[
                model.recipient.address,
                model.recipient.city,
                model.recipient.ice && `ICE : ${model.recipient.ice}`,
                model.recipient.phone,
                model.recipient.email,
              ]
                .filter(Boolean)
                .map((line) => text(line)),
            ],
          }),
          new TableCell({
            children: [
              text('INFORMATIONS', { color: '64748B', size: 14 }),
              text(`Date : ${formatDate(model.date)}`),
              ...(model.references ? [text(`Références : ${model.references}`)] : []),
              ...(model.paymentMethod ? [text(`Règlement : ${model.paymentMethod}`)] : []),
              ...(model.deliveryTime ? [text(`Délai : ${model.deliveryTime}`)] : []),
            ],
          }),
        ],
      }),
    ],
  })

  const lineTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [3600, 550, 650, 1250, 650, 600, 1700],
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          cell('Désignation', { header: true }),
          cell('Qté', { header: true, align: AlignmentType.RIGHT }),
          cell('Unité', { header: true, align: AlignmentType.CENTER }),
          cell('PU HT', { header: true, align: AlignmentType.RIGHT }),
          cell('Rem.', { header: true, align: AlignmentType.RIGHT }),
          cell('TVA', { header: true, align: AlignmentType.RIGHT }),
          cell('Total HT', { header: true, align: AlignmentType.RIGHT }),
        ],
      }),
      ...itemRows,
    ],
  })

  const totalsTable = new Table({
    width: { size: 55, type: WidthType.PERCENTAGE },
    columnWidths: [4500, 3500],
    rows: [
      ['Sous-total HT', formatMoney(model.totals.subtotalHT)],
      ...(model.totals.discounts ? [['Remises', `− ${formatMoney(model.totals.discounts)}`]] : []),
      ['Total HT', formatMoney(model.totals.totalHT)],
      ...model.totals.vatByRate.map((vat) => [`TVA ${formatPercent(vat.rate)}`, formatMoney(vat.amount)]),
      ['Total TTC', formatMoney(model.totals.totalTTC)],
    ].map(
      ([label, value], index) =>
        new TableRow({
          children: [
            new TableCell({
              shading: index === model.totals.vatByRate.length + 2 ? { fill: primary } : undefined,
              children: [text(label, { bold: index === model.totals.vatByRate.length + 2, color: index === model.totals.vatByRate.length + 2 ? 'FFFFFF' : '334155' })],
            }),
            new TableCell({
              shading: index === model.totals.vatByRate.length + 2 ? { fill: primary } : undefined,
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: value, bold: index === model.totals.vatByRate.length + 2, color: index === model.totals.vatByRate.length + 2 ? 'FFFFFF' : '334155' })] })],
            }),
          ],
        }),
    ),
  })

  const footerTexts = [
    model.options.showLegalMentions ? model.issuer.legalMentions : '',
    [
      model.issuer.ice && `ICE ${model.issuer.ice}`,
      model.issuer.rc && `RC ${model.issuer.rc}`,
      model.issuer.taxId && `IF ${model.issuer.taxId}`,
      model.issuer.patente && `Patente ${model.issuer.patente}`,
      model.issuer.cnss && `CNSS ${model.issuer.cnss}`,
      model.options.showBankDetails &&
        model.issuer.bankAccounts.find((account) => account.isDefault)?.rib,
    ]
      .filter(Boolean)
      .join(' · '),
  ].filter(Boolean)

  const fichaSections = model.sections.flatMap((section) => {
    const content: Array<Paragraph | Table> = [text(section.title, { bold: true, color: primary, size: 20 })]
    if (section.kind === 'fields' && section.fields?.length) {
      content.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [4500, 5500],
        rows: section.fields.map((field) => new TableRow({
          cantSplit: true,
          children: [
            cell(field.label, { header: true }),
            cell(field.value || '—'),
          ],
        })),
      }))
    }
    if (section.kind === 'table' && section.table) {
      content.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: section.table.columns.map((column) => cell(column, { header: true })),
          }),
          ...section.table.rows.map((row) => new TableRow({
            cantSplit: true,
            children: section.table?.columns.map((_, index) => cell(row[index] ?? '')) ?? [],
          })),
        ],
      }))
    }
    if (section.kind === 'checklist' && section.checks) {
      content.push(...section.checks.map((check) => text(`${check.checked ? '[X]' : '[ ]'} ${check.label}`)))
    }
    if (section.content) content.push(text(section.content))
    return content
  })

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 18, color: '334155' } },
      },
      paragraphStyles: [
        {
          id: 'TgiTitle',
          name: 'Titre TGI',
          basedOn: 'Normal',
          run: { bold: true, color: primary, size: 30, font: 'Arial' },
          paragraph: { spacing: { before: 180, after: 120 } },
        },
        {
          id: 'TgiHeading',
          name: 'Intertitre TGI',
          basedOn: 'Normal',
          run: { bold: true, color: primary, size: 20, font: 'Arial' },
          paragraph: { spacing: { before: 140, after: 70 } },
        },
      ],
    },
    title: `${cleanFileName(model.number)}_${cleanFileName(model.recipient.name)}`,
    creator: model.issuer.tradeName,
    sections: [
      {
        properties: {
          page: {
            size:
              model.options.orientation === 'landscape'
                ? { orientation: 'landscape' as const }
                : { orientation: 'portrait' as const },
            margin: { top: 700, right: 850, bottom: 900, left: 850 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [new TableRow({ children: headerCells })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              ...footerTexts.map((line) =>
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: line, size: 12, color: '64748B' })],
                }),
              ),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun('Page '),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                  new TextRun(' / '),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({ style: 'TgiTitle', text: model.title }),
          ...(model.references ? [text(model.references)] : []),
          recipient,
          new Paragraph({ text: '' }),
          ...(model.type === 'fiche'
            ? []
            : [
                lineTable,
                new Paragraph({ text: '' }),
                new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Récapitulatif', bold: true, color: primary })] }),
                totalsTable,
              ]),
          ...(model.options.showAmountInWords
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Arrêté le présent document à la somme de : ${numberToFrenchWords(model.totals.totalTTC)}.`,
                      italics: true,
                    }),
                  ],
                }),
              ]
            : []),
          ...(model.notes ? [new Paragraph({ style: 'TgiHeading', text: 'Notes' }), text(model.notes)] : []),
          ...(model.conditions
            ? [new Paragraph({ style: 'TgiHeading', text: 'Conditions' }), text(model.conditions)]
            : []),
          ...(model.type === 'fiche' ? fichaSections : model.sections.flatMap((section) => [
            new Paragraph({ style: 'TgiHeading', text: section.title }),
            text(section.content),
          ])),
          ...(model.options.showBankDetails
            ? model.issuer.bankAccounts
                .filter((account) => account.isDefault)
                .map((account) => text(`Coordonnées bancaires : ${account.bank} · RIB ${account.rib} · ${account.iban}`))
            : []),
          ...(model.options.showStamp && model.issuer.images.stamp
            ? [
                new Paragraph({
                  children: [
                    new ImageRun({
                      type: 'png',
                      data: imageBytes(model.issuer.images.stamp),
                      transformation: { width: 110, height: 85 },
                    }),
                  ],
                }),
              ]
            : []),
          ...(model.options.showSignature && model.issuer.images.signature
            ? [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new ImageRun({
                      type: 'png',
                      data: imageBytes(model.issuer.images.signature),
                      transformation: { width: 120, height: 60 },
                    }),
                  ],
                }),
              ]
            : []),
        ],
      },
    ],
  })

  return Packer.toBlob(doc)
}
