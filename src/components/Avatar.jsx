const PALETTE = [
  { bg: '#D7E2D6', fg: '#144516' },
  { bg: '#E8F4C8', fg: '#315719' },
  { bg: '#D7E8DF', fg: '#1E5638' },
  { bg: '#DDE9F0', fg: '#24536A' },
  { bg: '#F2E6C8', fg: '#665018' },
  { bg: '#F0DED4', fg: '#704532' },
  { bg: '#E8DFED', fg: '#534164' },
  { bg: '#E6E3D7', fg: '#565140' },
]

function colorIndex(seed = '') {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % PALETTE.length
  }
  return hash
}

function initials(name = '') {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2 && /^[A-Za-z]/.test(parts[0])) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  const first = Array.from(trimmed)[0] || '?'
  return /^[A-Za-z]$/.test(first) ? first.toUpperCase() : first
}

export default function Avatar({ src, name, userId, className = 'w-9 h-9', imageClassName = '' }) {
  const color = PALETTE[colorIndex(userId || name)]

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${className} rounded-full object-cover flex-shrink-0 ${imageClassName}`}
      />
    )
  }

  return (
    <div
      className={`${className} rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold`}
      style={{ backgroundColor: color.bg, color: color.fg }}
      aria-label={name}
      title={name}
    >
      {initials(name)}
    </div>
  )
}
