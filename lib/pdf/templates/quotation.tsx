import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export interface PDFSettings {
  pdfFormat: 'clasico' | 'moderno' | 'minimalista'
  fontFamily: string
  fontSize: number
  headerColor: string
  headerText: string
  logoSize: number
  nit: string
  companyEmail: string
  website: string
  address: string
  schedule: string
}

const DEFAULT_SETTINGS: PDFSettings = {
  pdfFormat: 'clasico',
  fontFamily: 'Helvetica',
  fontSize: 10,
  headerColor: '#f97316',
  headerText: '',
  logoSize: 60,
  nit: '',
  companyEmail: '',
  website: '',
  address: '',
  schedule: '',
}

function buildStyles(s: PDFSettings) {
  const color = s.headerColor

  return StyleSheet.create({
    page: {
      padding: 40,
      fontSize: s.fontSize,
      fontFamily: s.fontFamily,
      backgroundColor: '#ffffff',
    },

    // ── Clásico ────────────────────────────────────────────────────────────
    headerClasico: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 30,
      paddingBottom: 20,
      borderBottom: `2 solid ${color}`,
    },
    // ── Moderno ────────────────────────────────────────────────────────────
    headerModerno: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 30,
      padding: '14 20',
      backgroundColor: color,
      borderRadius: 4,
    },
    // ── Minimalista ────────────────────────────────────────────────────────
    headerMinimalista: {
      alignItems: 'center',
      marginBottom: 30,
      paddingBottom: 16,
      borderBottom: `1 solid #e5e7eb`,
    },

    companyNameDark: {
      fontSize: 20,
      fontWeight: 'bold',
      color: color,
      marginBottom: 4,
    },
    companyNameLight: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#ffffff',
      marginBottom: 4,
    },
    companyInfoDark: {
      fontSize: 8,
      color: '#666666',
      lineHeight: 1.4,
    },
    companyInfoLight: {
      fontSize: 8,
      color: 'rgba(255,255,255,0.85)',
      lineHeight: 1.4,
    },
    quotationInfo: {
      alignItems: 'flex-end',
    },
    quotationInfoLight: {
      alignItems: 'flex-end',
    },
    quotationNumber: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#1f2937',
      marginBottom: 4,
    },
    quotationNumberLight: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#ffffff',
      marginBottom: 4,
    },
    quotationMeta: {
      fontSize: 8,
      color: '#666666',
      lineHeight: 1.4,
    },
    quotationMetaLight: {
      fontSize: 8,
      color: 'rgba(255,255,255,0.85)',
      lineHeight: 1.4,
    },

    section: { marginBottom: 20 },
    sectionTitle: {
      fontSize: s.fontSize + 2,
      fontWeight: 'bold',
      color: '#1f2937',
      marginBottom: 8,
      paddingBottom: 4,
      borderBottom: '1 solid #e5e7eb',
    },
    clientInfo: {
      fontSize: s.fontSize,
      lineHeight: 1.6,
      color: '#374151',
    },

    table: { marginTop: 10, marginBottom: 20 },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: '#f3f4f6',
      padding: 7,
      fontWeight: 'bold',
      fontSize: s.fontSize - 1,
      borderBottom: `2 solid ${color}`,
    },
    tableHeaderMinimal: {
      flexDirection: 'row',
      padding: 7,
      fontWeight: 'bold',
      fontSize: s.fontSize - 1,
      borderBottom: `1 solid ${color}`,
    },
    tableRow: {
      flexDirection: 'row',
      padding: 7,
      borderBottom: '1 solid #e5e7eb',
      fontSize: s.fontSize - 1,
    },
    tableRowInventory: {
      flexDirection: 'row',
      padding: 7,
      borderBottom: '1 solid #e5e7eb',
      fontSize: s.fontSize - 1,
      backgroundColor: '#faf5ff',
    },
    tableRowGroup: {
      flexDirection: 'row',
      padding: 7,
      borderBottom: '1 solid #e5e7eb',
      fontSize: s.fontSize - 1,
      backgroundColor: '#ecfeff',
    },

    tableCol1: { width: '8%' },
    tableCol2: { width: '42%' },
    tableCol3: { width: '15%', textAlign: 'right' },
    tableCol4: { width: '15%', textAlign: 'right' },
    tableCol5: { width: '20%', textAlign: 'right' },

    itemDescription: { fontSize: s.fontSize - 1, color: '#1f2937' },
    itemDetails: { fontSize: s.fontSize - 3, color: '#6b7280', marginTop: 2 },
    inventoryBadge: {
      fontSize: s.fontSize - 4,
      color: '#7c3aed',
      backgroundColor: '#ede9fe',
      padding: '2 4',
      borderRadius: 2,
      marginTop: 2,
    },
    groupBadge: {
      fontSize: s.fontSize - 4,
      color: '#0891b2',
      backgroundColor: '#cffafe',
      padding: '2 4',
      borderRadius: 2,
      marginTop: 2,
    },
    groupItemsList: {
      fontSize: s.fontSize - 3,
      color: '#6b7280',
      marginTop: 4,
      paddingLeft: 8,
      lineHeight: 1.4,
    },

    totals: { marginTop: 20, alignItems: 'flex-end' },
    totalsRow: {
      flexDirection: 'row',
      width: '40%',
      justifyContent: 'space-between',
      padding: 5,
      fontSize: s.fontSize,
    },
    totalRow: {
      flexDirection: 'row',
      width: '40%',
      justifyContent: 'space-between',
      padding: 8,
      backgroundColor: color,
      color: '#ffffff',
      fontWeight: 'bold',
      fontSize: s.fontSize + 2,
      borderRadius: 4,
      marginTop: 5,
    },

    notes: {
      marginTop: 20,
      padding: 12,
      backgroundColor: '#f9fafb',
      borderRadius: 4,
      borderLeft: `4 solid ${color}`,
    },
    notesTitle: {
      fontSize: s.fontSize,
      fontWeight: 'bold',
      color: '#1f2937',
      marginBottom: 4,
    },
    notesText: {
      fontSize: s.fontSize - 1,
      color: '#4b5563',
      lineHeight: 1.5,
    },

    footer: {
      position: 'absolute',
      bottom: 30,
      left: 40,
      right: 40,
      textAlign: 'center',
      fontSize: 8,
      color: '#9ca3af',
      paddingTop: 12,
      borderTop: '1 solid #e5e7eb',
    },
    logoImage: {
      height: s.logoSize,
      maxWidth: s.logoSize * 3,
    },
    logoImageLight: {
      height: s.logoSize,
      maxWidth: s.logoSize * 3,
    },
  })
}

// Build company info lines from settings (only non-empty fields)
function buildCompanyInfo(s: PDFSettings): string {
  const lines = []
  if (s.headerText) lines.push(s.headerText)
  if (s.nit) lines.push(`NIT: ${s.nit}`)
  if (s.companyEmail) lines.push(s.companyEmail)
  if (s.website) lines.push(s.website)
  if (s.address) lines.push(s.address)
  if (s.schedule) lines.push(s.schedule)
  return lines.join('\n')
}

interface QuotationPDFProps {
  quotation: any
  settings?: PDFSettings
  logoSrc?: string
}

export function QuotationPDFDocument({ quotation, settings: rawSettings, logoSrc }: QuotationPDFProps) {
  const s = { ...DEFAULT_SETTINGS, ...rawSettings }
  const st = buildStyles(s)
  const companyInfo = buildCompanyInfo(s)
  const isModerno = s.pdfFormat === 'moderno'
  const isMinimalista = s.pdfFormat === 'minimalista'

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)

  const getItemInventoryDetails = (item: any) => {
    if (!item.inventoryItem) return null
    const inv = item.inventoryItem
    const parts: string[] = []
    if (inv.serialNumber) parts.push(`S/N: ${inv.serialNumber}`)
    return parts.length > 0 ? parts.join(' | ') : null
  }

  const getGroupItemsList = (group: any) => {
    if (!group.group?.items?.length) return null
    return group.group.items
      .map((item: any) => item.inventoryItem?.product?.name || 'Item')
      .join(', ')
  }

  const allLineItems: { type: 'item' | 'group'; data: any; order: number }[] = []
  if (quotation.items) {
    quotation.items.forEach((item: any) =>
      allLineItems.push({ type: 'item', data: item, order: item.order || 0 })
    )
  }
  if (quotation.groups) {
    quotation.groups.forEach((group: any) =>
      allLineItems.push({ type: 'group', data: group, order: group.order || 0 })
    )
  }
  allLineItems.sort((a, b) => a.order - b.order)

  // ── Header renderers ───────────────────────────────────────────────────────

  const renderHeader = () => {
    const quotationMeta =
      `Fecha: ${format(new Date(quotation.createdAt), 'dd MMMM yyyy', { locale: es })}\n` +
      `Válida hasta: ${format(new Date(quotation.validUntil), 'dd MMMM yyyy', { locale: es })}\n` +
      `Estado: ${quotation.status}`

    if (isModerno) {
      return (
        <View style={st.headerModerno}>
          <View>
            {logoSrc
              ? <Image src={logoSrc} style={st.logoImageLight} />
              : <Text style={st.companyNameLight}>XENITH</Text>}
            {companyInfo ? <Text style={st.companyInfoLight}>{companyInfo}</Text> : null}
          </View>
          <View style={st.quotationInfoLight}>
            <Text style={st.quotationNumberLight}>{quotation.quotationNumber}</Text>
            <Text style={st.quotationMetaLight}>{quotationMeta}</Text>
          </View>
        </View>
      )
    }

    if (isMinimalista) {
      return (
        <View style={st.headerMinimalista}>
          {logoSrc
            ? <Image src={logoSrc} style={st.logoImage} />
            : <Text style={st.companyNameDark}>XENITH</Text>}
          {companyInfo ? <Text style={st.companyInfoDark}>{companyInfo}</Text> : null}
          <Text style={{ ...st.quotationNumber, marginTop: 8 }}>{quotation.quotationNumber}</Text>
          <Text style={st.quotationMeta}>{quotationMeta}</Text>
        </View>
      )
    }

    // Clásico (default)
    return (
      <View style={st.headerClasico}>
        <View>
          {logoSrc
            ? <Image src={logoSrc} style={st.logoImage} />
            : <Text style={st.companyNameDark}>XENITH</Text>}
          {companyInfo ? <Text style={st.companyInfoDark}>{companyInfo}</Text> : null}
        </View>
        <View style={st.quotationInfo}>
          <Text style={st.quotationNumber}>{quotation.quotationNumber}</Text>
          <Text style={st.quotationMeta}>{quotationMeta}</Text>
        </View>
      </View>
    )
  }

  const tableHeaderStyle = isMinimalista ? st.tableHeaderMinimal : st.tableHeader

  return (
    <Document>
      <Page size="A4" style={st.page}>
        {renderHeader()}

        {/* Cliente */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Cliente</Text>
          <Text style={st.clientInfo}>
            {quotation.client.name}{'\n'}
            {quotation.client.company ? `${quotation.client.company}\n` : ''}
            {quotation.client.email}{'\n'}
            {quotation.client.phone ? `${quotation.client.phone}\n` : ''}
            {quotation.client.address ? `${quotation.client.address}\n` : ''}
            {quotation.client.city && quotation.client.country
              ? `${quotation.client.city}, ${quotation.client.country}\n`
              : ''}
            {quotation.client.taxId ? `RFC: ${quotation.client.taxId}` : ''}
          </Text>
        </View>

        {/* Título */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>{quotation.title}</Text>
          {quotation.description && (
            <Text style={st.clientInfo}>{quotation.description}</Text>
          )}
        </View>

        {/* Tabla */}
        <View style={st.table}>
          <View style={tableHeaderStyle}>
            <Text style={st.tableCol1}>#</Text>
            <Text style={st.tableCol2}>Descripción</Text>
            <Text style={st.tableCol3}>Cantidad</Text>
            <Text style={st.tableCol4}>Precio Unit.</Text>
            <Text style={st.tableCol5}>Total</Text>
          </View>
          {allLineItems.map((lineItem, index) => {
            if (lineItem.type === 'item') {
              const item = lineItem.data
              const invDetails = getItemInventoryDetails(item)
              return (
                <View key={`item-${item.id}`} style={item.inventoryItem ? st.tableRowInventory : st.tableRow}>
                  <Text style={st.tableCol1}>{index + 1}</Text>
                  <View style={st.tableCol2}>
                    <Text style={st.itemDescription}>{item.description}</Text>
                    {invDetails && <Text style={st.itemDetails}>{invDetails}</Text>}
                    {item.inventoryItem && <Text style={st.inventoryBadge}>INVENTARIO</Text>}
                  </View>
                  <Text style={st.tableCol3}>{item.quantity}</Text>
                  <Text style={st.tableCol4}>{formatCurrency(Number(item.unitPrice))}</Text>
                  <Text style={st.tableCol5}>{formatCurrency(Number(item.total))}</Text>
                </View>
              )
            }
            const group = lineItem.data
            const groupList = getGroupItemsList(group)
            return (
              <View key={`group-${group.id}`} style={st.tableRowGroup}>
                <Text style={st.tableCol1}>{index + 1}</Text>
                <View style={st.tableCol2}>
                  <Text style={st.itemDescription}>{group.name}</Text>
                  {group.description && <Text style={st.itemDetails}>{group.description}</Text>}
                  <Text style={st.groupBadge}>PAQUETE</Text>
                  {groupList && <Text style={st.groupItemsList}>Incluye: {groupList}</Text>}
                </View>
                <Text style={st.tableCol3}>{group.quantity}</Text>
                <Text style={st.tableCol4}>{formatCurrency(Number(group.unitPrice))}</Text>
                <Text style={st.tableCol5}>{formatCurrency(Number(group.total))}</Text>
              </View>
            )
          })}
        </View>

        {/* Totales */}
        <View style={st.totals}>
          <View style={st.totalsRow}>
            <Text>Subtotal:</Text>
            <Text>{formatCurrency(Number(quotation.subtotal))}</Text>
          </View>
          {Number(quotation.discount) > 0 && (
            <View style={st.totalsRow}>
              <Text>Descuento:</Text>
              <Text>-{formatCurrency(Number(quotation.discount))}</Text>
            </View>
          )}
          <View style={st.totalsRow}>
            <Text>IVA (19%):</Text>
            <Text>{formatCurrency(Number(quotation.tax))}</Text>
          </View>
          <View style={st.totalRow}>
            <Text>TOTAL:</Text>
            <Text>{formatCurrency(Number(quotation.total))}</Text>
          </View>
        </View>

        {quotation.notes && (
          <View style={st.notes}>
            <Text style={st.notesTitle}>Notas:</Text>
            <Text style={st.notesText}>{quotation.notes}</Text>
          </View>
        )}
        {quotation.terms && (
          <View style={st.notes}>
            <Text style={st.notesTitle}>Términos y Condiciones:</Text>
            <Text style={st.notesText}>{quotation.terms}</Text>
          </View>
        )}

        <Text style={st.footer}>
          Generado con XENITH · Sistema de Gestión de Proyectos
        </Text>
      </Page>
    </Document>
  )
}
