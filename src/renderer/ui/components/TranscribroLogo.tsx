interface Props {
  readonly size?: number
  readonly className?: string
}

/**
 * Transcribro logomark — mirrors the app icon design scaled to 24×24:
 *   • 5 symmetric waveform bars (top section)
 *   • 3 horizontal lines forming the inverted-T crossbar (bottom section)
 * Uses currentColor so it inherits the teal accent in any theme.
 */
export function TranscribroLogo({ size = 20, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/*
        5 bars — bar width 2.5, gap 1.5 → total 18.5px, start x=2.75
        All bars share the same bottom (y=15.5) so the base is flush.
        Heights: 7.5 / 10 / 11.5 / 10 / 7.5
      */}
      <rect x="2.75"  y="8"   width="2.5" height="7.5"  rx="1.25" fill="currentColor" opacity="0.50"/>
      <rect x="6.75"  y="5.5" width="2.5" height="10"   rx="1.25" fill="currentColor" opacity="0.75"/>
      <rect x="10.75" y="4"   width="2.5" height="11.5" rx="1.25" fill="currentColor"/>
      <rect x="14.75" y="5.5" width="2.5" height="10"   rx="1.25" fill="currentColor" opacity="0.75"/>
      <rect x="18.75" y="8"   width="2.5" height="7.5"  rx="1.25" fill="currentColor" opacity="0.50"/>

      {/* T crossbar — widest line, full opacity */}
      <rect x="2"   y="17"   width="20" height="2"   rx="1"    fill="currentColor" opacity="0.88"/>

      {/* Transcript line 2 */}
      <rect x="4.5" y="19.5" width="15" height="1.5" rx="0.75" fill="currentColor" opacity="0.58"/>

      {/* Transcript line 3 */}
      <rect x="7"   y="21.5" width="10" height="1.5" rx="0.75" fill="currentColor" opacity="0.32"/>
    </svg>
  )
}
