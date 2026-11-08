const maxPhotoSize = 100 * 1024

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('La compression de la photo a échoué.'))
      },
      'image/jpeg',
      quality,
    )
  })
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('La lecture de la photo a échoué.'))
    }
    reader.onerror = () => reject(new Error('La lecture de la photo a échoué.'))
    reader.readAsDataURL(blob)
  })
}

export async function compressProfilePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choisissez un fichier image valide.')
  }

  const imageUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = imageUrl
    try {
      await image.decode()
    } catch {
      throw new Error('Impossible de lire cette image. Choisissez un autre fichier.')
    }

    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (!context) throw new Error('La préparation de la photo a échoué.')

    const side = Math.min(image.naturalWidth, image.naturalHeight)
    const left = (image.naturalWidth - side) / 2
    const top = (image.naturalHeight - side) / 2
    context.drawImage(image, left, top, side, side, 0, 0, 256, 256)

    for (const quality of [0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]) {
      const blob = await canvasToJpeg(canvas, quality)
      const dataUrl = await readAsDataUrl(blob)
      if (new Blob([dataUrl]).size < maxPhotoSize) return dataUrl
    }

    throw new Error('Cette image ne peut pas être compressée sous 100 Ko.')
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}
