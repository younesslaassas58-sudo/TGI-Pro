const firebaseErrorMessages: Record<string, string> = {
  'auth/invalid-email': 'Veuillez saisir une adresse e-mail valide.',
  'auth/invalid-credential': 'Adresse e-mail ou mot de passe incorrect.',
  'auth/invalid-login-credentials': 'Adresse e-mail ou mot de passe incorrect.',
  'auth/user-not-found': 'Aucun compte ne correspond à cette adresse e-mail.',
  'auth/wrong-password': 'Adresse e-mail ou mot de passe incorrect.',
  'auth/too-many-requests': 'Trop de tentatives. Veuillez réessayer plus tard.',
  'auth/network-request-failed': 'Connexion réseau impossible. Vérifiez votre connexion.',
  'auth/user-disabled': 'Ce compte est désactivé. Contactez le directeur.',
  'auth/invalid-continue-uri': 'Le lien de réinitialisation est invalide.',
  'auth/operation-not-allowed': 'Cette opération n’est pas autorisée.',
}

export function getAuthErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return firebaseErrorMessages[error.code] ?? 'La connexion a échoué. Veuillez réessayer.'
  }

  return 'La connexion a échoué. Veuillez réessayer.'
}
