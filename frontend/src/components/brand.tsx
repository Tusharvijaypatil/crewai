import { cn } from '@/lib/utils'

/** Nimbus mark — three pipeline nodes flowing into one, on the iris→aqua gradient. */
export function Logo({ className, withWord = true }: { className?: string; withWord?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden className="shrink-0">
        <defs>
          <linearGradient id="nimbus-g" x1="2" y1="4" x2="30" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8E7BFF" />
            <stop offset="1" stopColor="#5BE1E6" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#nimbus-g)" fillOpacity="0.14" stroke="url(#nimbus-g)" strokeOpacity="0.5" />
        <path d="M8 21c3.2 0 3.2-10 6.4-10 3.2 0 3.2 10 6.4 10" stroke="url(#nimbus-g)" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="8" cy="21" r="2.4" fill="#8E7BFF" />
        <circle cx="14.4" cy="11" r="2.4" fill="#a99bff" />
        <circle cx="20.8" cy="21" r="2.4" fill="#5BE1E6" />
        <circle cx="24.5" cy="11.5" r="1.6" fill="#5BE1E6" />
      </svg>
      {withWord && (
        <span className="font-display text-[19px] font-semibold tracking-tight text-fg">Nimbus</span>
      )}
    </span>
  )
}

/** Ambient aurora + grid backdrop used behind hero / app surfaces. */
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="aurora absolute -top-40 left-1/2 h-[640px] w-[1100px] -translate-x-1/2 opacity-70 blur-[6px]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-iris-500/40 to-transparent" />
    </div>
  )
}
