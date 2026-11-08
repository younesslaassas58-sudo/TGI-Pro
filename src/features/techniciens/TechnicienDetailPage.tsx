import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import { Avatar, Badge, Button, Card, Spinner } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/features/auth/authStore'
import { usePermission } from '@/features/auth/usePermission'
import { specialtyLabels } from './types'
import { technicianHabilitationStatus } from './technicianUtils'
import { useTechnicienPrive, useTechniciens } from './useTechniciens'

type Tab = 'fiche' | 'interventions' | 'planning'

const expirationLabels = {
  valide: { label: 'Valide', color: 'bg-emerald-50 text-emerald-700' },
  bientot: { label: 'Expire bientôt', color: 'bg-amber-50 text-amber-700' },
  expire: { label: 'Expirée', color: 'bg-red-50 text-red-700' },
}

export function TechnicienDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data = [], isLoading, error } = useTechniciens()
  const role = useAuth((state) => state.profile?.role)
  const technician = data.find((item) => item.id === id)
  const director = usePermission('parametres', 'modifier')
  const [tab, setTab] = useState<Tab>('fiche')
  const privateQuery = useTechnicienPrive(id, Boolean(director && technician))
  const privateData = privateQuery.data
  const canGenerateDocument = role === 'directeur' || role === 'commercial'

  if (isLoading) return <Card className="p-8"><Spinner label="Chargement de la fiche technicien" /></Card>
  if (error) return <Card role="alert" className="p-6 text-sm text-danger-700">Impossible de charger cette fiche technicien.</Card>
  if (!technician) return <Card className="p-8 text-center"><p className="text-slate-600">Fiche technicien introuvable ou non accessible.</p><Button className="mt-4" variant="outline" onClick={() => navigate('/techniciens')}><ArrowLeft size={16} /> Retour aux techniciens</Button></Card>

  const sections = [
    ['Poste', technician.poste],
    ['Téléphone', technician.telephone],
    ['E-mail professionnel', technician.email],
    ['Zone d’intervention', technician.zoneIntervention],
    ['Disponibilité', technician.disponibilite],
    ['Véhicule', technician.vehicule],
  ]

  return <>
    <PageHeader title={`${technician.prenom} ${technician.nom}`} description={`Matricule ${technician.matricule}`} action={
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => navigate('/techniciens')}><ArrowLeft size={16} /> Retour</Button>
        {canGenerateDocument && <Button onClick={() => navigate('/documents/editor', { state: { ficha: { entity: 'technicien', id: technician.id } } })}><FileText size={16} /> Générer la fiche</Button>}
      </div>
    } />
    <Card className="mb-5 flex flex-wrap items-center gap-4 p-5">
      <Avatar name={`${technician.prenom} ${technician.nom}`} src={technician.photoURL || undefined} size="lg" />
      <div className="min-w-0 flex-1"><h2 className="font-heading text-lg font-semibold text-navy-900">{technician.prenom} {technician.nom}</h2><p className="text-sm text-slate-500">{technician.matricule}{technician.poste ? ` · ${technician.poste}` : ''}</p></div>
      <Badge className={technician.statut === 'actif' ? 'bg-emerald-50 text-emerald-700' : technician.statut === 'conge' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}>{technician.statut === 'actif' ? 'Actif' : technician.statut === 'conge' ? 'En congé' : 'Inactif'}</Badge>
    </Card>
    <div className="mb-4 flex gap-2 border-b border-slate-200" role="tablist" aria-label="Sections de la fiche technicien">
      {([['fiche', 'Informations'], ['interventions', 'Interventions'], ['planning', 'Planning']] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === key ? 'border-gold-500 text-navy-900' : 'border-transparent text-slate-500'}`} onClick={() => setTab(key)}>{label}</button>)}
    </div>
    {tab !== 'fiche' ? <Card className="p-12 text-center"><p className="font-medium text-slate-700">Disponible prochainement</p></Card> : <>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-heading font-semibold text-navy-900">Informations professionnelles</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">{sections.map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-800">{value || '—'}</dd></div>)}</dl>
          <h3 className="mt-5 text-sm font-semibold text-slate-800">Spécialités</h3><div className="mt-2 flex flex-wrap gap-2">{technician.specialites.map((item) => <Badge key={item}>{specialtyLabels[item]}</Badge>)}</div>
        </Card>
        <Card className="p-5">
          <h2 className="font-heading font-semibold text-navy-900">Habilitations et certifications</h2>
          {technician.habilitations.length === 0 ? <p className="mt-4 text-sm text-slate-500">Aucune habilitation renseignée.</p> : <ul className="mt-4 space-y-3">{technician.habilitations.map((item, index) => {
            const state = expirationLabels[technicianHabilitationStatus(item.dateExpiration)]
            return <li key={`${item.intitule}-${index}`} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-100 p-3"><div><p className="font-medium text-slate-800">{item.intitule}</p><p className="text-xs text-slate-500">{item.organisme || 'Organisme non renseigné'} · Expiration : {item.dateExpiration || 'sans échéance'}</p></div><Badge className={state.color}>{state.label}</Badge></li>
          })}</ul>}
        </Card>
        {director && <Card className="p-5 lg:col-span-2">
          <h2 className="font-heading font-semibold text-navy-900">Informations RH confidentielles</h2>
          {privateQuery.isLoading ? <div className="mt-4"><Spinner label="Chargement des données RH" /></div>
            : privateQuery.isError ? <p role="alert" className="mt-3 text-sm text-danger-700">Impossible de charger les informations RH.</p>
            : privateData && <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
              ['CIN', privateData.cin], ['Date de naissance', privateData.dateNaissance],
              ['Adresse', privateData.adresse], ['Date d’embauche', privateData.dateEmbauche],
              ['Type de contrat', privateData.typeContrat], ['Contact d’urgence', privateData.personneUrgenceNom],
              ['Téléphone d’urgence', privateData.personneUrgenceTelephone], ['Notes RH', privateData.notesRH],
            ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-800">{value || '—'}</dd></div>)}</dl>}
        </Card>}
      </div>
    </>}
  </>
}
