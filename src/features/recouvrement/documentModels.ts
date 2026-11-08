import { calculateTotals, formatDate, formatMoney, numberToFrenchWords } from '@/lib/format'
import type { CompanySettings } from '@/features/parametres/types'
import type { Echeance, Paiement, RecouvrementContrat, Relance } from './types'
import type { DocumentLine, DocumentModel } from '@/features/documents/types'

export function createPaymentReceipt(
  paiement: Paiement,
  issuer: CompanySettings,
  remainingBalanceCents: number,
): DocumentModel {
  const lines: DocumentLine[] = paiement.affectations.map((item, index) => ({
    id: `${paiement.id}-allocation-${index}`,
    designation: item.libelle,
    description: `Échéance ${item.echeanceId}`,
    quantity: 1,
    unit: 'affectation',
    unitPriceHT: item.montant / 100,
    discountPercent: 0,
    vatPercent: 0,
  }))
  const cancelled = paiement.annule
  const date = paiement.date.slice(0, 10)
  return {
    type: 'recu',
    watermarkText: cancelled ? 'ANNULÉ' : undefined,
    number: paiement.numero,
    date,
    title: 'Reçu de paiement',
    issuer,
    recipient: {
      name: paiement.client.nom,
      address: paiement.client.adresse,
      city: paiement.client.ville,
      ice: paiement.client.ice,
      phone: paiement.client.telephone,
      email: paiement.client.email,
    },
    references: paiement.reference,
    lines,
    totals: calculateTotals(lines),
    notes: `Montant reçu : ${numberToFrenchWords(paiement.montant / 100)}.\nSolde restant dû du client : ${(remainingBalanceCents / 100).toFixed(2)} MAD.\n${cancelled ? 'ANNULÉ — ' : ''}Reçu de paiement - ce document ne remplace pas une facture.`,
    conditions: paiement.annule ? `Paiement annulé le ${paiement.annuleLe ?? ''}. Motif : ${paiement.motifAnnulation ?? ''}` : '',
    paymentMethod: paiement.mode,
    deliveryTime: '',
    sections: [
      {
        id: 'payment-details',
        title: 'Détails de l’encaissement',
        kind: 'fields',
        content: '',
        fields: [
          { id: 'mode', label: 'Mode de paiement', value: paiement.mode },
          { id: 'reference', label: 'Référence', value: paiement.reference || '—' },
          { id: 'bank', label: 'Banque', value: paiement.banque || '—' },
          { id: 'amount', label: 'Montant en chiffres', value: `${(paiement.montant / 100).toFixed(2)} MAD` },
          { id: 'amount-words', label: 'Montant en toutes lettres', value: numberToFrenchWords(paiement.montant / 100) },
          { id: 'balance', label: 'Solde client après paiement', value: `${(remainingBalanceCents / 100).toFixed(2)} MAD` },
        ],
      },
    ],
    options: {
      showLogo: true,
      showStamp: issuer.documentAppearance.showStamp,
      showSignature: issuer.documentAppearance.showSignature,
      showBankDetails: issuer.documentAppearance.showBankDetails,
      showAmountInWords: true,
      showWatermark: cancelled,
      showLegalMentions: issuer.documentAppearance.showLegalMentions,
      showSlogan: issuer.documentAppearance.showSlogan,
      accentColor: issuer.documentAppearance.accentColor,
      orientation: 'portrait',
    },
}
}

export function createReminderLetter(
    issuer: CompanySettings,
    client: { nom: string; adresse: string; ville: string; ice: string; telephone: string; email: string },
    echeances: Echeance[],
    level: 1 | 2 | 3,
    number: string,
  ): DocumentModel {
    const totalCents = echeances.reduce((sum, item) => sum + item.montantTTC - item.montantPaye, 0)
    const tone = level === 1
      ? 'Nous vous prions de bien vouloir procéder au règlement des échéances ci-dessous. Si votre paiement a déjà été effectué, nous vous remercions de ne pas tenir compte de ce rappel.'
      : level === 2
        ? 'Malgré nos précédents échanges, les échéances ci-dessous restent impayées. Nous vous demandons de régulariser votre situation dans les meilleurs délais.'
        : 'Nous vous mettons en demeure de régler les sommes exigibles ci-dessous dans les huit jours suivant réception de la présente, sous réserve de nos droits et recours.'
    const lines: DocumentLine[] = echeances.map((item) => ({
      id: item.id,
      designation: item.libelle,
      description: `Échéance du ${formatDate(item.dateEcheance)}`,
      quantity: 1,
      unit: 'échéance',
      unitPriceHT: (item.montantTTC - item.montantPaye) / 100,
      discountPercent: 0,
      vatPercent: 0,
    }))
    const date = new Date().toISOString().slice(0, 10)
    return {
      type: 'relance',
      number,
      date,
      title: level === 1 ? 'Rappel amical de paiement' : level === 2 ? 'Relance ferme' : 'Mise en demeure avant action',
      issuer,
      recipient: {
        name: client.nom,
        address: client.adresse,
        city: client.ville,
        ice: client.ice,
        phone: client.telephone,
        email: client.email,
      },
      references: '',
      lines,
      totals: calculateTotals(lines),
      notes: `${tone}\n\nSolde exigible : ${numberToFrenchWords(totalCents / 100)}.`,
      conditions: 'Pour toute question relative à ce relevé, veuillez contacter notre service de recouvrement.',
      paymentMethod: '',
      deliveryTime: '',
      sections: [{
        id: 'reminder-details',
        title: 'Échéances impayées',
        kind: 'table',
        content: '',
        table: {
          columns: ['Échéance', 'Date', 'Montant dû (MAD)'],
          rows: echeances.map((item) => [item.libelle, formatDate(item.dateEcheance), (item.montantTTC - item.montantPaye) / 100 + ' MAD']),
        },
      }],
      options: {
        showLogo: true,
        showStamp: issuer.documentAppearance.showStamp,
        showSignature: issuer.documentAppearance.showSignature,
        showBankDetails: issuer.documentAppearance.showBankDetails,
        showAmountInWords: true,
        showWatermark: false,
        showLegalMentions: issuer.documentAppearance.showLegalMentions,
        showSlogan: issuer.documentAppearance.showSlogan,
        accentColor: issuer.documentAppearance.accentColor,
        orientation: 'portrait',
      },
    }
}

export function createClientRecoveryStatement(
    issuer: CompanySettings,
    client: { nom: string; adresse: string; ville: string; ice: string; telephone: string; email: string },
    echeances: Echeance[],
    paiements: Paiement[],
    relances: Relance[],
    aging: { jours0a30Cents: number; jours31a60Cents: number; jours61a90Cents: number; plus90JoursCents: number },
    number: string,
  ): DocumentModel {
    const events = [
        ...echeances.filter((item) => item.statut !== 'annulee').map((item) => ({
        date: item.dateEcheance,
        type: 'Échéance',
        description: item.libelle,
          amount: item.montantTTC,
        status: item.statut,
      })),
      ...paiements.filter((item) => !item.annule).map((item) => ({
        date: item.date,
        type: 'Paiement',
        description: `${item.numero} · ${item.mode}`,
        amount: -item.montant,
        status: 'Encaissé',
      })),
    ].sort((a, b) => a.date.localeCompare(b.date))
    const balanceCents = echeances.filter((item) => item.statut === 'ouverte')
      .reduce((sum, item) => sum + item.montantTTC - item.montantPaye, 0)
    return {
      type: 'fiche',
      number,
      date: new Date().toISOString().slice(0, 10),
      title: 'Fiche de recouvrement — relevé de situation client',
      issuer,
      recipient: {
        name: client.nom,
        address: client.adresse,
        city: client.ville,
        ice: client.ice,
        phone: client.telephone,
        email: client.email,
      },
      references: '',
      lines: [],
      totals: calculateTotals([]),
      notes: `Solde restant dû : ${formatMoney(balanceCents / 100)}.`,
      conditions: '',
      paymentMethod: '',
      deliveryTime: '',
      sections: [
        {
          id: 'statement-client',
          title: 'Situation',
          content: '',
          kind: 'fields',
          fields: [
            { id: 'balance', label: 'Solde restant dû', value: formatMoney(balanceCents / 100) },
            { id: 'aging-0-30', label: 'Retard 0 à 30 jours', value: formatMoney(aging.jours0a30Cents / 100) },
            { id: 'aging-31-60', label: 'Retard 31 à 60 jours', value: formatMoney(aging.jours31a60Cents / 100) },
            { id: 'aging-61-90', label: 'Retard 61 à 90 jours', value: formatMoney(aging.jours61a90Cents / 100) },
            { id: 'aging-90+', label: 'Retard supérieur à 90 jours', value: formatMoney(aging.plus90JoursCents / 100) },
          ],
        },
        {
          id: 'statement-events',
          title: 'Mouvements chronologiques',
          content: '',
          kind: 'table',
          table: {
            columns: ['Date', 'Type', 'Libellé', 'Montant (MAD)', 'Statut'],
            rows: events.map((item) => [formatDate(item.date), item.type, item.description, formatMoney(item.amount / 100), item.status]),
          },
        },
        {
          id: 'statement-reminders',
          title: 'Historique des relances et promesses',
          content: '',
          kind: 'table',
          table: {
            columns: ['Date', 'Niveau', 'Canal', 'Résultat', 'Promesse'],
            rows: relances.map((item) => [
              formatDate(item.date),
              String(item.niveau),
              item.canal,
              item.resultat,
              item.promesseDate ? `${formatDate(item.promesseDate)} · ${formatMoney((item.promesseMontant ?? 0) / 100)}` : '—',
            ]),
          },
        },
      ],
      options: {
        showLogo: true,
        showStamp: issuer.documentAppearance.showStamp,
        showSignature: issuer.documentAppearance.showSignature,
        showBankDetails: issuer.documentAppearance.showBankDetails,
        showAmountInWords: false,
        showWatermark: false,
        showLegalMentions: issuer.documentAppearance.showLegalMentions,
        showSlogan: issuer.documentAppearance.showSlogan,
        accentColor: issuer.documentAppearance.accentColor,
        orientation: 'landscape',
      },
    }
}

export function createContractScheduleDocument(
    issuer: CompanySettings,
    contrat: RecouvrementContrat,
    echeances: Echeance[],
  ): DocumentModel {
    const balanceCents = echeances
      .filter((item) => item.statut !== 'annulee')
      .reduce((sum, item) => sum + item.montantTTC - item.montantPaye, 0)
    return {
      type: 'fiche',
      number: contrat.numero,
      date: new Date().toISOString().slice(0, 10),
      title: `Échéancier du contrat ${contrat.numero}`,
      issuer,
      recipient: {
        name: contrat.client.nom,
        address: contrat.client.adresse,
        city: contrat.client.ville,
        ice: contrat.client.ice,
        phone: contrat.client.telephone,
        email: contrat.client.email,
      },
      references: contrat.ascenseursCodes.join(', '),
      lines: [],
      totals: calculateTotals([]),
      notes: `Solde restant : ${formatMoney(balanceCents / 100)}.`,
      conditions: '',
      paymentMethod: contrat.modePaiementHabituel,
      deliveryTime: '',
      sections: [
        {
          id: 'contract-summary',
          title: 'Détails du contrat',
          kind: 'fields',
          content: '',
          fields: [
            { id: 'period', label: 'Périodicité', value: contrat.periodicite },
            { id: 'service', label: 'Prestation', value: contrat.typePrestation },
            { id: 'start', label: 'Début', value: formatDate(contrat.dateDebut) },
            { id: 'end', label: 'Fin', value: contrat.dateFin ? formatDate(contrat.dateFin) : 'Sans date de fin' },
            { id: 'amount', label: 'Montant TTC par période', value: formatMoney(contrat.montantPeriodeTTC / 100) },
            { id: 'balance', label: 'Solde', value: formatMoney(balanceCents / 100) },
          ],
        },
        {
          id: 'contract-due-schedule',
          title: 'Échéancier',
          kind: 'table',
          content: '',
          table: {
            columns: ['Échéance', 'Période', 'HT (MAD)', 'TVA', 'TTC (MAD)', 'Payé (MAD)', 'Statut'],
            rows: echeances.map((item) => [
              formatDate(item.dateEcheance),
              `${formatDate(item.periodeDebut)} – ${formatDate(item.periodeFin)}`,
              formatMoney(item.montantHT / 100),
              `${item.tvaPct} %`,
              formatMoney(item.montantTTC / 100),
              formatMoney(item.montantPaye / 100),
              item.statut,
            ]),
          },
        },
      ],
      options: {
        showLogo: true,
        showStamp: issuer.documentAppearance.showStamp,
        showSignature: issuer.documentAppearance.showSignature,
        showBankDetails: issuer.documentAppearance.showBankDetails,
        showAmountInWords: false,
        showWatermark: false,
        showLegalMentions: issuer.documentAppearance.showLegalMentions,
        showSlogan: issuer.documentAppearance.showSlogan,
        accentColor: issuer.documentAppearance.accentColor,
        orientation: 'landscape',
      },
    }
  }
