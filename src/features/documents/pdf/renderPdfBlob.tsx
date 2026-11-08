import { pdf } from '@react-pdf/renderer'
import { PdfDocument } from './PdfDocument'
import type { DocumentModel } from '../types'

export async function renderPdfBlob(model: DocumentModel): Promise<Blob> {
  return pdf(<PdfDocument model={model} />).toBlob()
}
