import type { DocumentModel } from './types'

export type ExportFormat = 'pdf' | 'word' | 'excel'

function safeFilePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'document'
}

export function getDocumentFileName(model: DocumentModel, format: ExportFormat): string {
  return `${safeFilePart(model.number)}_${safeFilePart(model.recipient.name)}.${format === 'word' ? 'docx' : format === 'excel' ? 'xlsx' : 'pdf'}`
}

export async function renderDocument(model: DocumentModel, format: ExportFormat): Promise<Blob> {
  if (format === 'pdf') {
    const { renderPdfBlob } = await import('./pdf/renderPdfBlob')
    return renderPdfBlob(model)
  }
  if (format === 'word') {
    const { generateWord } = await import('./word/generateWord')
    return generateWord(model)
  }
  const { generateExcel } = await import('./excel/generateExcel')
  return generateExcel(model)
}

export async function exportDocument(model: DocumentModel, format: ExportFormat): Promise<void> {
  const [blob, fileSaver] = await Promise.all([
    renderDocument(model, format),
    import('file-saver'),
  ])
  fileSaver.saveAs(blob, getDocumentFileName(model, format))
}

export async function printDocument(model: DocumentModel): Promise<void> {
  const blob = await renderDocument(model, 'pdf')
  const objectUrl = URL.createObjectURL(blob)
  const printWindow = window.open(objectUrl, '_blank', 'noopener,noreferrer')
  if (!printWindow) {
    URL.revokeObjectURL(objectUrl)
    throw new Error('La fenêtre d’impression a été bloquée par le navigateur.')
  }
  printWindow.addEventListener(
    'load',
    () => {
      printWindow.print()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    },
    { once: true },
  )
}
