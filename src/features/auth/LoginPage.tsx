import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router-dom'
import { z } from 'zod'
import { Button, Card, Input, Label, Modal } from '@/components/ui'
import { LoadingScreen } from '@/components/layout/LoadingScreen'
import { useAuth } from './authStore'

const loginSchema = z.object({
  email: z.string().trim().email('Saisissez une adresse e-mail valide.'),
  password: z.string().min(1, 'Saisissez votre mot de passe.'),
})

const resetSchema = z.object({
  email: z.string().trim().email('Saisissez une adresse e-mail valide.'),
})

type LoginValues = z.infer<typeof loginSchema>
type ResetValues = z.infer<typeof resetSchema>

const highlights = [
  { icon: Building2, text: 'Un parc d’ascenseurs sous contrôle' },
  { icon: Wrench, text: 'Des opérations suivies avec précision' },
  { icon: ShieldCheck, text: 'Un espace sécurisé, pensé pour TGI' },
]

export function LoginPage() {
  const user = useAuth((state) => state.user)
  const loading = useAuth((state) => state.loading)
  const error = useAuth((state) => state.error)
  const signInWithEmail = useAuth((state) => state.signInWithEmail)
  const sendPasswordReset = useAuth((state) => state.sendPasswordReset)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    setValue: setResetValue,
    formState: { errors: resetErrors },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: '' },
  })

  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/" replace />

  async function onSubmit(values: LoginValues) {
    setSubmitting(true)
    try {
      await signInWithEmail(values.email, values.password)
    } catch {
      // L’erreur traduite est affichée par le store d’authentification.
    } finally {
      setSubmitting(false)
    }
  }

  async function onResetSubmit(values: ResetValues) {
    setResetSubmitting(true)
    try {
      await sendPasswordReset(values.email)
      setResetSent(true)
    } catch (error: unknown) {
      setResetError(error instanceof Error ? error.message : 'L’envoi du lien a échoué.')
    } finally {
      setResetSubmitting(false)
    }
  }

  function openReset() {
    setResetValue('email', getValues('email'))
    setResetSent(false)
    setResetError(null)
    setResetOpen(true)
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[minmax(24rem,0.95fr)_minmax(32rem,1.05fr)]">
      <section className="login-panel relative hidden min-h-screen flex-col justify-between overflow-hidden px-10 py-9 text-white lg:flex xl:px-16 xl:py-12">
        <div className="login-grid absolute inset-0 opacity-30" aria-hidden="true" />
        <div className="login-glow absolute -bottom-48 -right-36 size-[34rem] rounded-full" aria-hidden="true" />
        <div className="relative z-10">
          <Link to="/login" className="inline-flex items-center gap-3" aria-label="TGI-Pro">
            <span className="flex size-11 items-center justify-center rounded-xl border border-gold-300/40 bg-gradient-to-br from-gold-300 to-gold-500 font-heading text-base font-extrabold text-navy-950 shadow-[0_8px_24px_rgba(201,162,39,0.18)]">
              TGI
            </span>
            <span className="font-heading text-xl font-bold tracking-tight">
              TGI<span className="text-gold-400">-Pro</span>
            </span>
          </Link>
        </div>
        <div className="relative z-10 max-w-xl py-12">
          <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold-300">
            <span className="h-px w-8 bg-gold-400" />
            TGI Ascenseurs · depuis 1998
          </div>
          <h1 className="font-heading text-4xl font-semibold leading-[1.15] tracking-tight xl:text-[3.35rem]">
            La maîtrise du mouvement, jusque dans votre gestion.
          </h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-slate-300 xl:text-base">
            Un espace de travail conçu pour accompagner vos équipes, de l’installation à la
            maintenance.
          </p>
          <ul className="mt-10 space-y-4">
            {highlights.map(({ icon: Icon, text }, index) => (
              <li key={text} className="flex items-center gap-4 text-sm font-medium text-slate-200">
                <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gold-300">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span>{text}</span>
                <span className="ml-auto font-mono text-[10px] text-slate-500">0{index + 1}</span>
              </li>
            ))}
          </ul>
          <div className="mt-10 h-px w-20 bg-gradient-to-r from-gold-400/80 to-transparent" />
        </div>
        <div className="relative z-10 flex items-center justify-between gap-4 text-[11px] text-slate-400">
          <span>© {new Date().getFullYear()} TGI Ascenseurs</span>
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-success-500" />
            Espace professionnel sécurisé
          </span>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10 lg:px-12">
        <div className="login-enter w-full max-w-[430px]">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-xl bg-navy-900 font-heading text-sm font-extrabold text-gold-300">
              TGI
            </span>
            <span className="font-heading text-lg font-bold text-navy-950">
              TGI<span className="text-gold-600">-Pro</span>
            </span>
          </div>
          <div className="mb-7">
            <div className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-gold-50 text-gold-700">
              <Sparkles size={18} aria-hidden="true" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-700">
              Espace de travail
            </p>
            <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-navy-950">
              Heureux de vous revoir.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Connectez-vous avec vos identifiants TGI-Pro.
            </p>
          </div>

          <Card className="border-slate-200/80 p-6 shadow-[0_24px_70px_-24px_rgba(11,31,58,0.22),0_4px_14px_rgba(11,31,58,0.04)] sm:p-8">
            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div>
                <Label htmlFor="email" required>
                  Adresse e-mail
                </Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    size={17}
                    aria-hidden="true"
                  />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="nom@entreprise.ma"
                    className="pl-10 focus:border-gold-500 focus:ring-gold-100"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" className="mt-1.5 text-xs text-danger-700" role="alert">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <Label htmlFor="password" required className="mb-0">
                    Mot de passe
                  </Label>
                  <button
                    type="button"
                    className="text-xs font-semibold text-navy-700 transition-colors hover:text-gold-700"
                    onClick={openReset}
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <LockKeyhole
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    size={17}
                    aria-hidden="true"
                  />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Votre mot de passe"
                    className="pl-10 pr-12 focus:border-gold-500 focus:ring-gold-100"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-xl text-slate-500 transition-colors hover:text-navy-900"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="mt-1.5 text-xs text-danger-700" role="alert">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-danger-100 bg-danger-50/80 px-3.5 py-3.5 text-sm text-danger-800" role="alert">
                  <ShieldCheck className="mt-0.5 shrink-0 text-danger-700" size={17} aria-hidden="true" />
                  <p className="leading-5">{error}</p>
                </div>
              )}

              <Button type="submit" className="login-submit w-full" loading={submitting}>
                Se connecter
                {!submitting && <ArrowRight size={16} aria-hidden="true" />}
              </Button>
            </form>
          </Card>
          <p className="mt-6 text-center text-xs leading-5 text-slate-400">
            Accès réservé aux utilisateurs autorisés par TGI Ascenseurs.
          </p>
        </div>
      </section>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Réinitialiser le mot de passe"
      >
        {resetSent ? (
          <div className="py-2">
            <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-success-50 text-success-700">
              <CheckCircle2 size={22} aria-hidden="true" />
            </div>
            <p className="text-sm leading-6 text-slate-600">
              Si ce compte existe, un e-mail de réinitialisation a été envoyé.
            </p>
            <Button className="mt-5 w-full" onClick={() => setResetOpen(false)}>
              Fermer
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleResetSubmit(onResetSubmit)} noValidate>
            <p className="text-sm leading-6 text-slate-600">
              Indiquez l’adresse e-mail associée à votre compte.
            </p>
            {resetError && (
              <p className="rounded-xl border border-danger-100 bg-danger-50 px-3.5 py-3 text-sm text-danger-700" role="alert">
                {resetError}
              </p>
            )}
            <div>
              <Label htmlFor="reset-email" required>
                Adresse e-mail
              </Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                placeholder="nom@entreprise.ma"
                aria-invalid={Boolean(resetErrors.email)}
                aria-describedby={resetErrors.email ? 'reset-email-error' : undefined}
                {...registerReset('email')}
              />
              {resetErrors.email && (
                <p id="reset-email-error" className="mt-1.5 text-xs text-danger-700" role="alert">
                  {resetErrors.email.message}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setResetOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" loading={resetSubmitting}>
                <KeyRound size={16} aria-hidden="true" />
                Envoyer le lien
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </main>
  )
}
