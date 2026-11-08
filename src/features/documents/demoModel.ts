import { calculateTotals } from '@/lib/format'
import type { CompanySettings } from '@/features/parametres/types'
import type { DocumentLine, DocumentModel } from './types'

function line(
  id: string,
  designation: string,
  description: string,
  quantity: number,
  unit: string,
  unitPriceHT: number,
  discountPercent = 0,
): DocumentLine {
  return {
    id,
    designation,
    description,
    quantity,
    unit,
    unitPriceHT,
    discountPercent,
    vatPercent: 20,
  }
}

export function createDemoModel(issuer: CompanySettings): DocumentModel {
  const lines = [
    line('demo-1', 'Modernisation du tableau de commande', 'Fourniture et remplacement du système de commande, paramétrage et essais de fonctionnement.', 1, 'forfait', 18500, 5),
    line('demo-2', 'Remplacement des boutons palières', 'Ensemble de boutons lumineux inox brossé avec repérage des étages.', 8, 'unité', 480),
    line('demo-3', 'Main-d’œuvre et mise en service', 'Intervention par techniciens qualifiés, réglages, vérifications et remise du rapport de mise en service.', 2, 'jour', 2200),
  ]

  return {
    type: 'devis',
    number: 'DEV-2026-0001',
    date: new Date().toISOString().slice(0, 10),
    title: 'Modernisation d’un ascenseur',
    issuer,
    recipient: {
      name: 'Syndic Résidence Al Amal',
      address: '12, avenue des FAR',
      city: 'Casablanca',
      ice: '001234567890123',
      phone: '+212 5 22 00 00 00',
      email: 'contact@residence-exemple.ma',
    },
    references: 'Visite technique du 05/11/2026 · Ascenseur n° A-014',
    lines,
    totals: calculateTotals(lines),
    notes: 'Le présent devis est établi après visite technique sur site.',
    conditions: 'Validité du devis : 30 jours. Paiement selon les conditions convenues entre les parties.',
    paymentMethod: 'Virement bancaire',
    deliveryTime: '4 à 6 semaines après validation',
    sections: [
      {
        id: 'scope',
        title: 'Périmètre des travaux',
        content: 'Les travaux comprennent la fourniture, la pose, les réglages et les essais de sécurité.',
      },
    ],
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

export function createStressTestModel(issuer: CompanySettings): DocumentModel {
  const model = createDemoModel(issuer)
  const description =
    'Fourniture, préparation, livraison sur site, installation et réglage conformément aux prescriptions techniques du fabricant, aux règles de l’art et aux normes applicables. Comprend également la vérification fonctionnelle détaillée, la documentation technique associée, la coordination avec le syndic et la remise d’un compte rendu complet à la fin de chaque étape.'
  const lines = Array.from({ length: 40 }, (_, index) =>
    line(
      `stress-${index + 1}`,
      `Équipement et prestation technique ${index + 1} — composant de sécurité et de commande`,
      description,
      (index % 3) + 1,
      index % 2 === 0 ? 'unité' : 'forfait',
      375 + index * 29,
      index % 5 === 0 ? 5 : 0,
    ),
  )

  return {
    ...model,
    number: 'DEV-TEST-40L',
    title: 'Document de test de charge — quarante lignes',
    lines,
    totals: calculateTotals(lines),
    notes: `${description}\n\n${description}`,
    conditions: `${description}\n\n${description}`,
    sections: [
      ...model.sections,
      { id: 'stress-section', title: 'Conditions détaillées', content: `${description}\n\n${description}` },
    ],
  }
}
