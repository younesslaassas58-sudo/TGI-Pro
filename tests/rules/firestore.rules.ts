import { readFileSync } from 'node:fs'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
} from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

let environment: RulesTestEnvironment

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-tgi-pro-rules',
    firestore: {
      rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
    },
  })
})

afterAll(async () => {
  await environment.cleanup()
})

beforeEach(async () => {
  await environment.clearFirestore()
})

async function seedProfile(uid: string, role: string, active = true): Promise<void> {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', uid), { role, active })
  })
}

describe('règles Firestore', () => {
  it('refuse la lecture anonyme et celle d’un compte inactif', async () => {
    const anonymousDb = environment.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(anonymousDb, 'clients', 'client-1')))

    await seedProfile('inactive', 'commercial', false)
    const inactiveDb = environment.authenticatedContext('inactive').firestore()
    await assertFails(getDoc(doc(inactiveDb, 'clients', 'client-1')))
  })

  it('empêche un commercial de supprimer ou d’annuler un paiement', async () => {
    await seedProfile('commercial-1', 'commercial')
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'paiements', 'payment-1'), {
        id: 'payment-1',
        numero: 'REC-0001',
        createdAt: '2026-01-01',
        createdBy: 'commercial-1',
        updatedBy: 'commercial-1',
        annule: false,
        montant: 10_000,
      })
    })
    const db = environment.authenticatedContext('commercial-1').firestore()
    await assertFails(deleteDoc(doc(db, 'paiements', 'payment-1')))
    await assertFails(updateDoc(doc(db, 'paiements', 'payment-1'), {
      annule: true,
      motifAnnulation: 'Erreur',
      annulePar: 'commercial-1',
      annuleLe: '2026-02-01',
      updatedAt: '2026-02-01',
      updatedBy: 'commercial-1',
    }))
  })

  it('interdit au technicien de lire les devis, paiements et données RH', async () => {
    await seedProfile('technician-1', 'technicien')
    const db = environment.authenticatedContext('technician-1').firestore()
    await assertFails(getDoc(doc(db, 'devis', 'quote-1')))
    await assertFails(getDoc(doc(db, 'paiements', 'payment-1')))
    await assertFails(getDoc(doc(db, 'techniciens_prives', 'technician-1')))
  })

  it('autorise uniquement les champs et transitions prévus sur ses interventions', async () => {
    await seedProfile('technician-1', 'technicien')
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'interventions', 'intervention-1'), {
        id: 'intervention-1',
        numero: 'INT-0001',
        createdAt: '2026-01-01',
        createdBy: 'director-1',
        updatedAt: '2026-01-01',
        updatedBy: 'director-1',
        statut: 'planifiee',
        techniciensUids: ['technician-1'],
      })
    })
    const db = environment.authenticatedContext('technician-1').firestore()
    const reference = doc(db, 'interventions', 'intervention-1')
    await assertSucceeds(updateDoc(reference, {
      statut: 'en_cours',
      dateDebutReelle: '2026-02-01',
      updatedAt: '2026-02-01',
      updatedBy: 'technician-1',
    }))
    await assertFails(updateDoc(reference, {
      priorite: 'urgente',
      updatedAt: '2026-02-02',
      updatedBy: 'technician-1',
    }))
  })

  it('refuse de modifier un mouvement de stock', async () => {
    await seedProfile('director-1', 'directeur')
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'mouvements', 'movement-1'), {
        id: 'movement-1',
        annule: false,
        type: 'entree_manuelle',
        quantite: 1,
      })
    })
    const db = environment.authenticatedContext('director-1').firestore()
    await assertFails(updateDoc(doc(db, 'mouvements', 'movement-1'), { quantite: 2 }))
  })

  it('empêche un commercial de modifier le contenu figé d’un contrat', async () => {
    await seedProfile('commercial-1', 'commercial')
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'contrats', 'contract-1'), {
        id: 'contract-1',
        numero: 'CTR-0001',
        createdAt: '2026-01-01',
        createdBy: 'commercial-1',
        updatedBy: 'commercial-1',
        clientId: 'client-1',
        notes: 'Version validée',
      })
    })
    const db = environment.authenticatedContext('commercial-1').firestore()
    await assertFails(updateDoc(doc(db, 'contrats', 'contract-1'), {
      notes: 'Contenu altéré',
      updatedAt: '2026-02-01',
      updatedBy: 'commercial-1',
    }))
  })

  it('autorise l’ajout au journal par son auteur mais interdit sa modification et sa suppression', async () => {
    await seedProfile('director-1', 'directeur')
    const db = environment.authenticatedContext('director-1').firestore()
    const reference = doc(collection(db, 'auditLogs'))
    await assertSucceeds(setDoc(reference, {
      date: Timestamp.now(),
      uid: 'director-1',
      nom: 'Directeur',
      role: 'directeur',
      action: 'creation',
      entityType: 'client',
      entityId: 'client-1',
      resume: 'Création d’une fiche client',
      meta: {},
    }))
    await assertFails(updateDoc(reference, { resume: 'altéré' }))
    await assertFails(deleteDoc(reference))
  })
})
