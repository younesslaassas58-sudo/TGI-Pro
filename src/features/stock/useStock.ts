import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/features/auth/authStore'
import { getNextNumber } from '@/features/documents/getNextNumber'
import { articleSchema, type Article } from '@/features/catalogue/types'
import { calculerAnnulationMouvement, calculerEcartInventaire, calculerMouvement, quantiteASuggerer } from './logic'
import {
  depotSchema,
  inventaireSchema,
  mouvementSchema,
  stockCoutSchema,
  stockNiveauSchema,
  type Depot,
  type Inventaire,
  type InventaireLigne,
  type Mouvement,
  type MouvementInput,
  type StockCout,
  type StockNiveau,
} from './types'

const depotKey = ['stock', 'depots']
const niveauKey = ['stock', 'niveaux']
const coutKey = ['stock', 'couts']
const movementKey = ['stock', 'mouvements']
const inventoryKey = ['stock', 'inventaires']

async function loadCollection<T>(name: string, parse: (value: unknown) => T): Promise<T[]> {
  const result = await getDocs(collection(db, name))
  return result.docs.map((snapshot) => parse({ ...snapshot.data(), id: snapshot.id }))
}

export function stockNiveauId(articleId: string, depotId: string): string {
  return `${articleId}_${depotId}`
}

export function useDepots() {
  const user = useAuth((state) => state.user)
  const role = useAuth((state) => state.profile?.role)
  return useQuery({
    queryKey: [...depotKey, role, user?.uid],
    queryFn: async () => {
      if (role !== 'technicien') return loadCollection('depots', depotSchema.parse)
      if (!user) return []
      const result = await getDocs(query(collection(db, 'depots'), where('technicienUid', '==', user.uid)))
      return result.docs.map((snapshot) => depotSchema.parse({ ...snapshot.data(), id: snapshot.id }))
    },
  })
}

export function useStockNiveaux(depotId?: string, enabled = true) {
  return useQuery({
    queryKey: [...niveauKey, depotId ?? 'all'],
    queryFn: async () => {
      if (!depotId) return loadCollection('stockNiveaux', stockNiveauSchema.parse)
      const result = await getDocs(query(collection(db, 'stockNiveaux'), where('depotId', '==', depotId)))
      return result.docs.map((snapshot) => stockNiveauSchema.parse({ ...snapshot.data(), id: snapshot.id }))
    },
    enabled,
  })
}

export function useStockCouts(enabled: boolean) {
  return useQuery({
    queryKey: coutKey,
    queryFn: () => loadCollection('stockCouts', stockCoutSchema.parse),
    enabled,
  })
}

export function useMouvements(enabled = true, depotId?: string) {
  return useQuery({
    queryKey: [...movementKey, depotId ?? 'all'],
    queryFn: async () => {
      if (!depotId) return loadCollection('mouvements', mouvementSchema.parse)
      const [source, destination] = await Promise.all([
        getDocs(query(collection(db, 'mouvements'), where('depotSourceId', '==', depotId))),
        getDocs(query(collection(db, 'mouvements'), where('depotDestinationId', '==', depotId))),
      ])
      const snapshots = new Map([...source.docs, ...destination.docs].map((snapshot) => [snapshot.id, snapshot]))
      return [...snapshots.values()].map((snapshot) => mouvementSchema.parse({ ...snapshot.data(), id: snapshot.id }))
    },
    enabled,
  })
}

export function useInventaires(enabled = true) {
  return useQuery({ queryKey: inventoryKey, queryFn: () => loadCollection('inventaires', inventaireSchema.parse), enabled })
}

function invalidateStock(client: ReturnType<typeof useQueryClient>) {
  for (const key of [depotKey, niveauKey, coutKey, movementKey, inventoryKey, ['articles']]) {
    void client.invalidateQueries({ queryKey: key })
  }
}

export function useCreateDepot() {
  const client = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async (input: Omit<Depot, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>) => {
      const reference = doc(collection(db, 'depots'))
      const now = new Date().toISOString()
      const depots = await getDocs(collection(db, 'depots'))
      const next = depots.size + 1
      const depot = depotSchema.parse({
        ...input,
        id: reference.id,
        code: `DEP-${String(next).padStart(2, '0')}`,
        createdAt: now,
        updatedAt: now,
        createdBy: uid,
        updatedBy: uid,
      })
      await setDoc(reference, depot)
      return depot
    },
    onSuccess: () => invalidateStock(client),
  })
}

export function useUpdateDepot() {
  const client = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ depot, changes }: {
      depot: Depot
      changes: { nom?: string; adresse?: string; type?: Depot['type']; technicienId?: string; technicienUid?: string; actif?: boolean }
    }) => {
      const { technicienId, technicienUid, ...fields } = changes
      await updateDoc(doc(db, 'depots', depot.id), {
        ...fields,
        ...(changes.type === 'vehicule'
          ? { technicienId, technicienUid }
          : changes.type ? { technicienId: deleteField(), technicienUid: deleteField() } : {}),
        updatedAt: new Date().toISOString(),
        updatedBy: uid,
      })
    },
    onSuccess: () => invalidateStock(client),
  })
}

export function useEnsureMainDepot() {
  const create = useCreateDepot()
  return useMutation({
    mutationFn: async () => {
      const snapshot = await getDocs(collection(db, 'depots'))
      if (snapshot.size) return false
      await create.mutateAsync({
        nom: 'Dépôt principal',
        type: 'principal',
        adresse: '',
        actif: true,
        archive: false,
      })
      return true
    },
  })
}

export function useApplyStockMovement() {
  const client = useQueryClient()
  const user = useAuth((state) => state.user)
  const profile = useAuth((state) => state.profile)
  return useMutation({
    mutationFn: async (input: MouvementInput) => {
      if (!user || !profile) throw new Error('Session utilisateur indisponible.')
      if (!input.motif.trim() && ['sortie_manuelle', 'casse_perte', 'ajustement_inventaire'].includes(input.type)) {
        throw new Error('Un motif est obligatoire pour cette opération.')
      }
      const articleSnapshot = await getDoc(doc(db, 'articles', input.articleId))
      if (!articleSnapshot.exists()) throw new Error('Article introuvable.')
      const article = articleSchema.parse({ ...articleSnapshot.data(), id: articleSnapshot.id })
      if (!article.suiviStock) throw new Error('Cet article n’est pas suivi en stock.')
      if (!input.depotSourceId && input.type !== 'entree_achat' && input.type !== 'entree_manuelle' && input.type !== 'entree_retour') {
        throw new Error('Sélectionnez le dépôt source.')
      }
      if (!input.depotDestinationId && ['entree_achat', 'entree_manuelle', 'entree_retour', 'transfert'].includes(input.type)) {
        throw new Error('Sélectionnez le dépôt de destination.')
      }
      const numero = await getNextNumber('mouvement_stock')
      const now = new Date().toISOString()
      const reference = doc(collection(db, 'mouvements'))
      const sourceRef = input.depotSourceId ? doc(db, 'stockNiveaux', stockNiveauId(article.id, input.depotSourceId)) : undefined
      const destinationRef = input.depotDestinationId ? doc(db, 'stockNiveaux', stockNiveauId(article.id, input.depotDestinationId)) : undefined
      const sourceDepotRef = input.depotSourceId ? doc(db, 'depots', input.depotSourceId) : undefined
      const destinationDepotRef = input.depotDestinationId ? doc(db, 'depots', input.depotDestinationId) : undefined
      if (input.type === 'transfert' && input.depotSourceId === input.depotDestinationId) {
        throw new Error('Choisissez deux dépôts différents pour le transfert.')
      }
      const costRef = doc(db, 'stockCouts', article.id)
      const settingRef = doc(db, 'settings', 'company')
      const mayGoNegative = profile.role === 'directeur'
      const settings = await (await import('firebase/firestore')).getDoc(settingRef)
      const allowNegative = mayGoNegative && settings.data()?.autoriserStockNegatif === true
      const movementType = input.type
      const isEntry = ['entree_achat', 'entree_manuelle', 'entree_retour'].includes(movementType)
      const isTransfer = movementType === 'transfert'

      await runTransaction(db, async (transaction) => {
        const [sourceSnap, destinationSnap, costSnap] = await Promise.all([
          sourceRef ? transaction.get(sourceRef) : Promise.resolve(undefined),
          destinationRef ? transaction.get(destinationRef) : Promise.resolve(undefined),
          transaction.get(costRef),
        ])
        const [sourceDepotSnap, destinationDepotSnap] = await Promise.all([
          sourceDepotRef ? transaction.get(sourceDepotRef) : Promise.resolve(undefined),
          destinationDepotRef ? transaction.get(destinationDepotRef) : Promise.resolve(undefined),
        ])
        for (const [snapshot, depotId] of [
          [sourceDepotSnap, input.depotSourceId],
          [destinationDepotSnap, input.depotDestinationId],
        ] as const) {
          if (!depotId) continue
          if (!snapshot?.exists()) throw new Error('Le dépôt sélectionné est introuvable.')
          const depot = depotSchema.parse({ ...snapshot.data(), id: snapshot.id })
          if (!depot.actif || depot.archive) throw new Error(`Le dépôt « ${depot.nom} » est inactif ou archivé.`)
        }
        const source = sourceSnap?.exists() ? stockNiveauSchema.parse({ ...sourceSnap.data(), id: sourceSnap.id }) : undefined
        const destination = destinationSnap?.exists()
          ? stockNiveauSchema.parse({ ...destinationSnap.data(), id: destinationSnap.id })
          : undefined
        const cost = costSnap.exists() ? stockCoutSchema.parse(costSnap.data()) : {
          articleId: article.id, pmpHT: article.prixAchatCents, dernierPrixAchatHT: article.prixAchatCents,
          quantiteTotale: 0, updatedAt: now,
        }
        const total = cost.quantiteTotale
        const planType = isEntry ? 'entree' : isTransfer ? 'transfert' : movementType === 'ajustement_inventaire' ? 'ajustement' : 'sortie'
        const planned = calculerMouvement({
          type: planType,
          quantite: input.quantite,
          quantiteSource: source?.quantite ?? 0,
          quantiteDestination: destination?.quantite ?? 0,
          quantiteTotale: total,
          pmpHT: cost.pmpHT,
          ...(isEntry ? { coutUnitaireHT: input.coutUnitaireHT ?? article.prixAchatCents } : {}),
          autoriserStockNegatif: allowNegative,
        })
        const buildLevel = (depotId: string, quantity: number) => ({
          id: stockNiveauId(article.id, depotId),
          articleId: article.id,
          depotId,
          quantite: quantity,
          codeSnapshot: article.code,
          designationSnapshot: article.designation,
          unite: article.unite,
          updatedAt: now,
        })
        if (sourceRef) transaction.set(sourceRef, buildLevel(input.depotSourceId!, planned.quantiteSource))
        if (destinationRef) transaction.set(destinationRef, buildLevel(input.depotDestinationId!, planned.quantiteDestination))
        if (isEntry) {
          transaction.set(costRef, {
            articleId: article.id,
            pmpHT: planned.pmpHT,
            dernierPrixAchatHT: input.coutUnitaireHT ?? article.prixAchatCents,
            quantiteTotale: planned.quantiteTotale,
            updatedAt: now,
          })
        } else if (planType === 'sortie') {
          transaction.set(costRef, { ...cost, quantiteTotale: planned.quantiteTotale, updatedAt: now })
        }
        const movement = mouvementSchema.parse({
          id: reference.id,
          numero,
          date: now.slice(0, 10),
          type: movementType,
          articleId: article.id,
          codeSnapshot: article.code,
          designationSnapshot: article.designation,
          unite: article.unite,
          ...(input.depotSourceId ? { depotSourceId: input.depotSourceId } : {}),
          ...(input.depotDestinationId ? { depotDestinationId: input.depotDestinationId } : {}),
          quantite: input.quantite,
          ...(isEntry ? { coutUnitaireHT: input.coutUnitaireHT ?? article.prixAchatCents } : {}),
          pmpAvant: cost.pmpHT,
          pmpApres: planned.pmpHT,
          ...(sourceRef ? { soldeSourceApres: planned.quantiteSource } : {}),
          ...(destinationRef ? { soldeDestinationApres: planned.quantiteDestination } : {}),
          ...(input.reference ? { reference: input.reference } : {}),
          motif: input.motif,
          uid: user.uid,
          auteurNom: profile.displayName || profile.email,
          annule: false,
          createdAt: now,
        })
        transaction.set(reference, movement)
      })
    },
    onSuccess: () => invalidateStock(client),
  })
}

export function useCancelStockMovement() {
  const client = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  const profile = useAuth((state) => state.profile)
  return useMutation({
    mutationFn: async ({ movement, motif }: { movement: Mouvement; motif: string }) => {
      if (!motif.trim()) throw new Error('Le motif d’annulation est obligatoire.')
      if (!profile || profile.role !== 'directeur') throw new Error('Seul le directeur peut annuler un mouvement.')
      if (movement.annule) throw new Error('Ce mouvement est déjà annulé.')
      const number = await getNextNumber('mouvement_stock')
      const now = new Date().toISOString()
      const inverseRef = doc(collection(db, 'mouvements'))
      const originalRef = doc(db, 'mouvements', movement.id)
      const sourceId = movement.depotSourceId
      const destinationId = movement.depotDestinationId
      const sourceRef = sourceId ? doc(db, 'stockNiveaux', stockNiveauId(movement.articleId, sourceId)) : undefined
      const destRef = destinationId ? doc(db, 'stockNiveaux', stockNiveauId(movement.articleId, destinationId)) : undefined
      const costRef = doc(db, 'stockCouts', movement.articleId)
      await runTransaction(db, async (transaction) => {
        const [original, sourceSnap, destSnap, costSnap] = await Promise.all([
          transaction.get(originalRef),
          sourceRef ? transaction.get(sourceRef) : Promise.resolve(undefined),
          destRef ? transaction.get(destRef) : Promise.resolve(undefined),
          transaction.get(costRef),
        ])
        if (!original.exists() || original.data().annule) throw new Error('Le mouvement est absent ou déjà annulé.')
        const source = sourceSnap?.exists() ? stockNiveauSchema.parse({ ...sourceSnap.data(), id: sourceSnap.id }) : undefined
        const dest = destSnap?.exists() ? stockNiveauSchema.parse({ ...destSnap.data(), id: destSnap.id }) : undefined
        const cost = costSnap.exists() ? stockCoutSchema.parse(costSnap.data()) : undefined
        if (!cost) throw new Error('Le coût de stock est introuvable.')
        if ((sourceRef && !source) || (destRef && !dest)) throw new Error('Un niveau de stock lié au mouvement est introuvable.')
        const plan = calculerAnnulationMouvement({
          type: movement.type,
          ...(movement.direction ? { direction: movement.direction } : {}),
          quantite: movement.quantite,
          quantiteSource: source?.quantite ?? 0,
          quantiteDestination: dest?.quantite ?? 0,
          quantiteTotale: cost.quantiteTotale,
          pmpHT: cost.pmpHT,
          pmpAvant: movement.pmpAvant ?? cost.pmpHT,
          ...(movement.coutUnitaireHT !== undefined ? { coutUnitaireHT: movement.coutUnitaireHT } : {}),
        })
        const transfer = movement.type === 'transfert'
        const inbound = ['entree_achat', 'entree_manuelle', 'entree_retour'].includes(movement.type)
        const outbound = ['sortie_livraison', 'sortie_intervention', 'sortie_manuelle', 'casse_perte'].includes(movement.type)
        const adjustmentEntry = movement.type === 'ajustement_inventaire' && movement.direction === 'entree'
        const adjustmentExit = movement.type === 'ajustement_inventaire' && movement.direction === 'sortie'
        const inverseSourceRef = inbound || transfer || adjustmentEntry ? destRef : undefined
        const inverseDestRef = outbound || transfer || adjustmentExit ? sourceRef : undefined
        const inverseSourceBalance = plan.quantiteDestination
        const inverseDestBalance = plan.quantiteSource
        const inverseMovementBase = { ...movement }
        delete inverseMovementBase.depotSourceId
        delete inverseMovementBase.depotDestinationId
        delete inverseMovementBase.soldeSourceApres
        delete inverseMovementBase.soldeDestinationApres
        if (sourceRef && source) transaction.update(sourceRef, { quantite: plan.quantiteSource, updatedAt: now })
        if (destRef && dest) transaction.update(destRef, { quantite: plan.quantiteDestination, updatedAt: now })
        transaction.update(costRef, {
          pmpHT: plan.pmpHT,
          quantiteTotale: plan.quantiteTotale,
          updatedAt: now,
        })
        transaction.update(originalRef, { annule: true, mouvementInverseId: inverseRef.id })
        transaction.set(inverseRef, mouvementSchema.parse({
            ...inverseMovementBase,
            id: inverseRef.id,
            numero: number,
            date: now.slice(0, 10),
            type: plan.inverseType,
            ...(plan.inverseDirection ? { direction: plan.inverseDirection } : {}),
            quantite: movement.quantite,
            pmpAvant: cost.pmpHT,
            pmpApres: plan.pmpHT,
            ...(inverseSourceRef && destinationId ? { depotSourceId: destinationId } : {}),
            ...(inverseDestRef && sourceId ? { depotDestinationId: sourceId } : {}),
            ...(inverseSourceRef ? { soldeSourceApres: inverseSourceBalance } : {}),
            ...(inverseDestRef ? { soldeDestinationApres: inverseDestBalance } : {}),
            motif: `Annulation de ${movement.numero} : ${motif.trim()}`,
            uid,
            auteurNom: profile.displayName || profile.email,
            annule: false,
            mouvementInverseId: movement.id,
            createdAt: now,
        }))
      })
    },
    onSuccess: () => invalidateStock(client),
  })
}

export function useCreateInventory() {
  const client = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ depotId, lignes, notes }: { depotId: string; lignes: InventaireLigne[]; notes: string }) => {
      const numero = await getNextNumber('inventaire')
      const reference = doc(collection(db, 'inventaires'))
      const now = new Date().toISOString()
      const inventaire = inventaireSchema.parse({
        id: reference.id, numero, depotId, date: now.slice(0, 10), statut: 'en_cours',
        lignes: lignes.map((line) => ({ ...line, quantiteComptee: undefined, ecart: undefined, valeurEcart: undefined })),
        totalEcartValeur: 0, notes, createdAt: now, updatedAt: now, createdBy: uid, updatedBy: uid,
      })
      await setDoc(reference, inventaire)
      return inventaire
    },
    onSuccess: () => invalidateStock(client),
  })
}

export function useSaveInventoryCounts() {
  const client = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ inventory, lignes }: { inventory: Inventaire; lignes: InventaireLigne[] }) => {
      if (inventory.statut !== 'en_cours') throw new Error('Seul un inventaire en cours peut être modifié.')
      const updated = inventaireSchema.parse({ ...inventory, lignes, updatedAt: new Date().toISOString(), updatedBy: uid })
      await setDoc(doc(db, 'inventaires', inventory.id), updated)
      return updated
    },
    onSuccess: () => invalidateStock(client),
  })
}

export function useValidateInventory() {
  const client = useQueryClient()
  const user = useAuth((state) => state.user)
  const profile = useAuth((state) => state.profile)
  return useMutation({
    mutationFn: async (inventory: Inventaire) => {
      if (profile?.role !== 'directeur') throw new Error('Seul le directeur peut valider un inventaire.')
      if (inventory.statut !== 'en_cours' || inventory.lignes.some((line) => line.quantiteComptee === undefined)) {
        throw new Error('Complétez toutes les quantités avant la validation.')
      }
      if (!user || !profile) throw new Error('Session utilisateur indisponible.')
      const now = new Date().toISOString()
      if (new Set(inventory.lignes.map((line) => line.articleId)).size !== inventory.lignes.length) {
        throw new Error('L’inventaire contient plusieurs lignes pour le même article.')
      }
      if (inventory.lignes.some((line) => !Number.isFinite(line.quantiteComptee) || (line.quantiteComptee ?? -1) < 0)) {
        throw new Error('Les quantités comptées doivent être des nombres positifs ou nuls.')
      }
      const currentLevelsSnapshot = await getDocs(query(collection(db, 'stockNiveaux'), where('depotId', '==', inventory.depotId)))
      const currentLevels = new Map(currentLevelsSnapshot.docs.map((snapshot) => {
        const level = stockNiveauSchema.parse({ ...snapshot.data(), id: snapshot.id })
        return [level.articleId, level.quantite] as const
      }))
      const changed = inventory.lignes.flatMap((line) => {
        const quantity = line.quantiteComptee ?? 0
        const currentQuantity = currentLevels.get(line.articleId) ?? 0
        return quantity !== currentQuantity ? [{ line, currentQuantity }] : []
      })
      if (changed.length > 150) throw new Error('Un inventaire ne peut pas produire plus de 150 ajustements à la fois.')
      const movementNumbers = await Promise.all(changed.map(() => getNextNumber('mouvement_stock')))
      const inventoryRef = doc(db, 'inventaires', inventory.id)
      const levelRefs = changed.map(({ line }) => doc(db, 'stockNiveaux', stockNiveauId(line.articleId, inventory.depotId)))
      const costRefs = changed.map(({ line }) => doc(db, 'stockCouts', line.articleId))
      await runTransaction(db, async (transaction) => {
        const [inventorySnap, ...snapshots] = await Promise.all([
          transaction.get(inventoryRef),
          ...levelRefs.map((reference) => transaction.get(reference)),
          ...costRefs.map((reference) => transaction.get(reference)),
        ])
        if (!inventorySnap.exists() || inventorySnap.data().statut !== 'en_cours'
          || inventorySnap.data().updatedAt !== inventory.updatedAt) {
          throw new Error('Cet inventaire n’est plus disponible pour validation.')
        }
        const levelSnapshots = snapshots.slice(0, changed.length)
        const costSnapshots = snapshots.slice(changed.length)
        let totalVariance = 0
        const actualQuantities = new Map<string, number>()
        changed.forEach(({ line, currentQuantity: expectedQuantity }, index) => {
          const levelRef = levelRefs[index]
          const costRef = costRefs[index]
          const levelSnapshot = levelSnapshots[index]
          const costSnapshot = costSnapshots[index]
          const currentQuantity = levelSnapshot.exists()
            ? stockNiveauSchema.parse({ ...levelSnapshot.data(), id: levelSnapshot.id }).quantite
            : 0
          if (currentQuantity !== expectedQuantity) {
            throw new Error('Le stock a changé pendant le comptage. Actualisez l’inventaire avant de le valider.')
          }
          const nextQuantity = line.quantiteComptee ?? 0
          const quantityDelta = nextQuantity - currentQuantity
          if (nextQuantity < 0) throw new Error(`L’inventaire ferait passer ${line.designationSnapshot} en stock négatif.`)
          const currentCost = costSnapshot.exists() ? stockCoutSchema.parse(costSnapshot.data()) : {
            articleId: line.articleId,
            pmpHT: line.coutUnitaire,
            dernierPrixAchatHT: line.coutUnitaire,
            quantiteTotale: currentQuantity,
            updatedAt: now,
          }
          const nextTotal = currentCost.quantiteTotale + quantityDelta
          if (nextTotal < 0) throw new Error('L’inventaire rendrait la quantité totale négative.')
          const isEntry = quantityDelta > 0
          const movementRef = doc(collection(db, 'mouvements'))
          const movement = mouvementSchema.parse({
            id: movementRef.id,
            numero: movementNumbers[index],
            date: now.slice(0, 10),
            type: 'ajustement_inventaire',
            direction: isEntry ? 'entree' : 'sortie',
            articleId: line.articleId,
            codeSnapshot: line.codeSnapshot,
            designationSnapshot: line.designationSnapshot,
            unite: line.unite,
            ...(isEntry ? { depotDestinationId: inventory.depotId } : { depotSourceId: inventory.depotId }),
            quantite: Math.abs(quantityDelta),
            pmpAvant: currentCost.pmpHT,
            pmpApres: currentCost.pmpHT,
            ...(isEntry ? { soldeDestinationApres: nextQuantity } : { soldeSourceApres: nextQuantity }),
            reference: { type: 'inventaire', id: inventory.id },
            motif: `Écart d’inventaire ${inventory.numero}`,
            uid: user.uid,
            auteurNom: profile.displayName || profile.email,
            annule: false,
            createdAt: now,
          })
          transaction.set(levelRef, {
            id: stockNiveauId(line.articleId, inventory.depotId),
            articleId: line.articleId,
            depotId: inventory.depotId,
            quantite: nextQuantity,
            codeSnapshot: line.codeSnapshot,
            designationSnapshot: line.designationSnapshot,
            unite: line.unite,
            updatedAt: now,
          })
          transaction.set(costRef, {
            ...currentCost,
            quantiteTotale: nextTotal,
            updatedAt: now,
          })
          transaction.set(movementRef, movement)
          actualQuantities.set(line.articleId, currentQuantity)
          totalVariance += calculerEcartInventaire(currentQuantity, nextQuantity, line.coutUnitaire).valeurEcart
        })
        transaction.update(inventoryRef, {
          statut: 'valide',
          lignes: inventory.lignes.map((line) => ({
            ...line,
            quantiteTheorique: actualQuantities.get(line.articleId) ?? currentLevels.get(line.articleId) ?? 0,
            ...calculerEcartInventaire(
              actualQuantities.get(line.articleId) ?? currentLevels.get(line.articleId) ?? 0,
              line.quantiteComptee ?? 0,
              line.coutUnitaire,
            ),
          })),
          totalEcartValeur: totalVariance,
          validePar: user.uid,
          valideLe: now,
          updatedAt: now,
          updatedBy: user.uid,
        })
      })
    },
    onSuccess: () => invalidateStock(client),
  })
}

export function suggestedQuantity(article: Article, amount: number) {
  return quantiteASuggerer(article, amount)
}

export function getTechnicianDepot(depots: Depot[], uid: string): Depot | undefined {
  return depots.find((depot) => depot.type === 'vehicule' && depot.technicienUid === uid && depot.actif && !depot.archive)
}

export type StockCostSnapshot = StockCout
export type StockLevelSnapshot = StockNiveau
