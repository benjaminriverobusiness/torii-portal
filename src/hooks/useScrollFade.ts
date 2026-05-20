import { useEffect, useRef } from 'react'

export function useScrollFade() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' }
    )

    const items = el.querySelectorAll('.fade-in')
    items.forEach((item) => observer.observe(item))

    return () => observer.disconnect()
  }, [])

  return ref
}
