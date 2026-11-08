export async function compressInterventionImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choisissez une image valide.')
  const source = await createImageBitmap(file)
  const scale = Math.min(1, 1280 / Math.max(source.width, source.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('La compression de l’image est indisponible sur cet appareil.')
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  source.close()
  let quality = 0.7
  let result = canvas.toDataURL('image/jpeg', quality)
  while (new Blob([result]).size > 200 * 1024 && quality > 0.3) {
    quality -= 0.1
    result = canvas.toDataURL('image/jpeg', quality)
  }
  if (new Blob([result]).size > 200 * 1024) throw new Error('Impossible de compresser cette image sous 200 Ko.')
  return result
}
