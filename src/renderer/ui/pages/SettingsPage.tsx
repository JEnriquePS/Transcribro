import { useEffect, useState } from 'react'
import { Settings, Loader2, RotateCcw, Save, Terminal, Info, Cpu, Languages, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { ipc } from '../../infrastructure/ipc-client'
import { useSettings } from '../../application/hooks/use-settings'
import { whisperSettingsSchema, type WhisperSettings } from '../../../shared/schemas'
import { WHISPER_DEFAULTS, WHISPER_LIMITS, KNOWN_MODELS } from '../../../shared/constants'

const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'auto', label: 'Auto-detect' },
] as const

/** Form draft — numeric fields kept as strings while the user types. */
interface Draft {
  readonly defaultModel: string
  readonly defaultLanguage: string
  readonly threads: string
  readonly noSpeechThold: string
  readonly entropyThold: string
  readonly logprobThold: string
  readonly maxContext: string
}

type NumericKey = 'threads' | 'noSpeechThold' | 'entropyThold' | 'logprobThold' | 'maxContext'

interface TuningField {
  readonly key: Exclude<NumericKey, 'threads'>
  readonly flag: string
  readonly label: string
  readonly description: string
  readonly step: number
}

const TUNING_FIELDS: readonly TuningField[] = [
  {
    key: 'noSpeechThold',
    flag: '--no-speech-thold',
    label: 'No-speech threshold',
    description:
      'Probability threshold for treating a segment as silence. Segments whose no-speech probability exceeds this value are discarded. Higher values filter silence more aggressively.',
    step: 0.05,
  },
  {
    key: 'entropyThold',
    flag: '--entropy-thold',
    label: 'Entropy threshold',
    description:
      'Entropy limit for decoder fallback. When the average entropy of decoded tokens exceeds this value, the segment is treated as a repetition/hallucination and re-decoded. Lower values are stricter.',
    step: 0.1,
  },
  {
    key: 'logprobThold',
    flag: '--logprob-thold',
    label: 'Log-probability threshold',
    description:
      'Minimum average log-probability per token. Segments below this confidence trigger a decoding fallback. Values closer to 0 are stricter.',
    step: 0.1,
  },
  {
    key: 'maxContext',
    flag: '--max-context',
    label: 'Max context',
    description:
      'Text tokens from the previous segment kept as decoding context. 0 disables context (prevents hallucination cascades); -1 uses the model maximum (224 tokens).',
    step: 1,
  },
]

function toDraft(s: WhisperSettings): Draft {
  return {
    defaultModel: s.defaultModel,
    defaultLanguage: s.defaultLanguage,
    threads: String(s.threads),
    noSpeechThold: String(s.noSpeechThold),
    entropyThold: String(s.entropyThold),
    logprobThold: String(s.logprobThold),
    maxContext: String(s.maxContext),
  }
}

/** Convert the draft into a candidate settings object (NaN when a field is not a number). */
function parseDraft(d: Draft): WhisperSettings {
  const num = (v: string): number => (v.trim() === '' ? NaN : Number(v))
  return {
    defaultModel: d.defaultModel,
    defaultLanguage: d.defaultLanguage,
    threads: num(d.threads),
    noSpeechThold: num(d.noSpeechThold),
    entropyThold: num(d.entropyThold),
    logprobThold: num(d.logprobThold),
    maxContext: num(d.maxContext),
  }
}

function validateDraft(d: Draft): { errors: Partial<Record<keyof Draft, string>>; parsed: WhisperSettings } {
  const parsed = parseDraft(d)
  const errors: Partial<Record<keyof Draft, string>> = {}

  const numericKeys: readonly NumericKey[] = [
    'threads', 'noSpeechThold', 'entropyThold', 'logprobThold', 'maxContext',
  ]
  for (const key of numericKeys) {
    if (Number.isNaN(parsed[key])) errors[key] = 'Enter a valid number'
  }

  const result = whisperSettingsSchema.safeParse(parsed)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof Draft | undefined
      if (key && !errors[key]) errors[key] = issue.message
    }
  }
  return { errors, parsed }
}

/** Mirrors buildWhisperArgs in main/infrastructure/services/whisper-transcriber.ts (display only). */
function buildCommandPreview(d: Draft): string {
  const lang = d.defaultLanguage === 'auto' ? '--detect-language' : `-l ${d.defaultLanguage}`
  return [
    'whisper-cli',
    `  -m models/ggml-${d.defaultModel}.bin`,
    '  -f <job>/audio.wav',
    '  -of <job>/transcript',
    '  --output-json --output-srt --output-vtt --output-txt',
    '  --print-progress',
    `  -t ${d.threads}`,
    `  --no-speech-thold ${d.noSpeechThold}`,
    `  --entropy-thold ${d.entropyThold}`,
    `  --logprob-thold ${d.logprobThold}`,
    `  --max-context ${d.maxContext}`,
    `  ${lang}`,
  ].join(' \\\n')
}

const inputClass =
  'w-full bg-surface-elevated border border-border-default rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface'

interface NumberFieldProps {
  readonly id: string
  readonly label: string
  readonly flag?: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly error?: string
  readonly description: string
  readonly defaultValue: number
  readonly min: number
  readonly max: number
  readonly step: number
}

function NumberField({
  id, label, flag, value, onChange, error, description, defaultValue, min, max, step,
}: NumberFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-text-primary mb-1">
        {label}
        {flag && (
          <code className="text-[11px] text-text-secondary bg-surface-elevated px-1.5 py-0.5 rounded">
            {flag}
          </code>
        )}
      </label>
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-help`}
        className={`${inputClass} max-w-[180px] ${error ? 'border-error' : ''}`}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-error">
          {error}
        </p>
      )}
      <p id={`${id}-help`} className="mt-1 text-xs text-text-secondary leading-relaxed">
        {description}{' '}
        <span className="text-text-muted whitespace-nowrap">
          Default: {defaultValue} · Range: {min} to {max}
        </span>
      </p>
    </div>
  )
}

export function SettingsPage() {
  const { settings, loading, error, save, reset } = useSettings()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof Draft, string>>>({})
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [downloadedModels, setDownloadedModels] = useState<ReadonlySet<string> | null>(null)

  useEffect(() => {
    if (settings && !draft) setDraft(toDraft(settings))
  }, [settings, draft])

  useEffect(() => {
    ipc
      .listModels()
      .then((data) => {
        setDownloadedModels(new Set(data.models.filter((m) => m.available).map((m) => m.name)))
      })
      .catch(() => setDownloadedModels(null))
  }, [])

  if (loading || (!draft && !error)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin motion-reduce:animate-none text-text-secondary" />
      </div>
    )
  }

  if (error || !draft || !settings) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-sm text-error bg-error-muted border border-error rounded px-3 py-2">
          {error ?? 'Failed to load settings'}
        </p>
      </div>
    )
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(toDraft(settings))

  const setField = (key: keyof Draft) => (value: string) => {
    setDraft({ ...draft, [key]: value })
    if (fieldErrors[key]) setFieldErrors({ ...fieldErrors, [key]: undefined })
  }

  const handleSave = async () => {
    const { errors, parsed } = validateDraft(draft)
    if (Object.values(errors).some(Boolean)) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setSaving(true)
    try {
      const saved = await save(parsed)
      setDraft(toDraft(saved))
      toast.success('Settings saved — applied to the next transcription')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      const restored = await reset()
      setDraft(toDraft(restored))
      setFieldErrors({})
      toast.success('Default settings restored')
    } catch {
      toast.error('Failed to restore defaults')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
          <Settings size={22} className="text-accent-text" />
          Settings
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Parameters passed to whisper.cpp. Changes apply to the next transcription — no restart needed.
        </p>
      </div>

      {/* ── General ── */}
      <section className="bg-surface border border-border-default rounded-lg p-5 space-y-5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
          <Cpu size={15} className="text-text-secondary" />
          General
        </h2>

        <div>
          <label htmlFor="default-model" className="flex items-center gap-2 text-sm font-medium text-text-primary mb-1">
            Default model
            <code className="text-[11px] text-text-secondary bg-surface-elevated px-1.5 py-0.5 rounded">-m</code>
          </label>
          <select
            id="default-model"
            value={draft.defaultModel}
            onChange={(e) => setField('defaultModel')(e.target.value)}
            className={`${inputClass} appearance-none cursor-pointer max-w-[280px]`}
          >
            {KNOWN_MODELS.map((m) => {
              const downloaded = downloadedModels?.has(m.name) ?? true
              return (
                <option key={m.name} value={m.name} disabled={!downloaded}>
                  {m.name}{downloaded ? '' : ' (not downloaded)'}
                </option>
              )
            })}
          </select>
          <p className="mt-1 text-xs text-text-secondary leading-relaxed">
            Model preselected for new transcriptions. Only downloaded models can be set as default —
            manage them in the Models tab.
          </p>
        </div>

        <div>
          <label htmlFor="default-language" className="flex items-center gap-2 text-sm font-medium text-text-primary mb-1">
            <Languages size={14} className="text-text-secondary" />
            Default language
            <code className="text-[11px] text-text-secondary bg-surface-elevated px-1.5 py-0.5 rounded">-l</code>
          </label>
          <select
            id="default-language"
            value={draft.defaultLanguage}
            onChange={(e) => setField('defaultLanguage')(e.target.value)}
            className={`${inputClass} appearance-none cursor-pointer max-w-[280px]`}
          >
            {LANGUAGES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-text-secondary leading-relaxed">
            Language preselected for new transcriptions. Auto-detect passes{' '}
            <code className="text-[11px]">--detect-language</code> instead.
          </p>
        </div>

        <NumberField
          id="threads"
          label="CPU threads"
          flag="-t"
          value={draft.threads}
          onChange={setField('threads')}
          error={fieldErrors.threads}
          description="Threads used for CPU-side work. Heavy compute runs on the GPU (Metal), so this mainly affects pre/post-processing."
          defaultValue={WHISPER_DEFAULTS.threads}
          min={WHISPER_LIMITS.threads.min}
          max={WHISPER_LIMITS.threads.max}
          step={1}
        />
      </section>

      {/* ── Whisper tuning ── */}
      <section className="bg-surface border border-border-default rounded-lg p-5 space-y-5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
          <SlidersHorizontal size={15} className="text-text-secondary" />
          Whisper tuning
        </h2>

        {TUNING_FIELDS.map((field) => (
          <NumberField
            key={field.key}
            id={field.key}
            label={field.label}
            flag={field.flag}
            value={draft[field.key]}
            onChange={setField(field.key)}
            error={fieldErrors[field.key]}
            description={field.description}
            defaultValue={WHISPER_DEFAULTS[field.key]}
            min={WHISPER_LIMITS[field.key].min}
            max={WHISPER_LIMITS[field.key].max}
            step={field.step}
          />
        ))}
      </section>

      {/* ── Command preview ── */}
      <section className="bg-surface border border-border-default rounded-lg p-5 space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
          <Terminal size={15} className="text-text-secondary" />
          Command preview
        </h2>
        <p className="text-xs text-text-secondary leading-relaxed">
          Full command executed per job with the values above. Model and language can still be
          overridden per transcription from the Upload page.
        </p>
        <div className="overflow-x-auto">
          <pre className="text-xs font-mono text-text-primary bg-surface-elevated border border-border-subtle rounded p-3 leading-relaxed">
            {buildCommandPreview(draft)}
          </pre>
        </div>
        <p className="flex items-start gap-1.5 text-xs text-text-secondary leading-relaxed">
          <Info size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Managed by the app and not configurable: <code className="text-[11px]">-f</code>/
            <code className="text-[11px]">-of</code> (input/output paths),{' '}
            <code className="text-[11px]">--output-*</code> (all formats are always generated),{' '}
            <code className="text-[11px]">--print-progress</code> (progress reporting) and{' '}
            <code className="text-[11px]">--offset</code> (only added when resuming a failed job).
          </span>
        </p>
      </section>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleReset}
          disabled={resetting || saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm rounded border border-border-default text-text-secondary hover:text-text-primary hover:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {resetting ? (
            <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
          ) : (
            <RotateCcw size={14} />
          )}
          Restore defaults
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || resetting || !isDirty}
          title={!isDirty ? 'No changes to save' : undefined}
          className="flex items-center gap-1.5 px-4 py-2 text-sm rounded bg-accent hover:bg-accent-hover text-text-inverse font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
          ) : (
            <Save size={14} />
          )}
          Save changes
        </button>
      </div>
    </div>
  )
}
