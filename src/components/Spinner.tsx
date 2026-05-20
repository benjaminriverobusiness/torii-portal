interface SpinnerProps {
  size?: number
  color?: string
}

export function Spinner({ size = 32, color = '#e5182b' }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{
        animation: 'spin 0.8s linear infinite',
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
