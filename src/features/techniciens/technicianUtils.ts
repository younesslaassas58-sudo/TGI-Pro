export function technicianHabilitationStatus(expiration: string): 'valide' | 'bientot' | 'expire' {
  if (!expiration) return 'valide'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(`${expiration}T00:00:00`)
  if (Number.isNaN(end.getTime())) return 'valide'
  if (end < today) return 'expire'
  const limit = new Date(today)
  limit.setDate(limit.getDate() + 60)
  return end <= limit ? 'bientot' : 'valide'
}
