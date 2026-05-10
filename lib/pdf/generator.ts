import ReactPDF from '@react-pdf/renderer'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { QuotationPDFDocument, PDFSettings } from './templates/quotation'

function readSettings(): PDFSettings | undefined {
  try {
    const path = join(process.cwd(), 'data', 'settings.json')
    if (!existsSync(path)) return undefined
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return undefined
  }
}

export async function generateQuotationPDF(quotation: any): Promise<Buffer> {
  const settings = readSettings()
  const doc = QuotationPDFDocument({ quotation, settings })
  const pdfStream = await ReactPDF.renderToStream(doc)

  const chunks: Buffer[] = []
  return new Promise((resolve, reject) => {
    pdfStream.on('data', (chunk: Buffer) => chunks.push(chunk))
    pdfStream.on('end', () => resolve(Buffer.concat(chunks)))
    pdfStream.on('error', reject)
  })
}
