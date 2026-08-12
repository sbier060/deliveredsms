// Robust clipboard copy. Uses the async Clipboard API when available and falls
// back to a hidden textarea + execCommand. Never throws — clipboard-write can be
// blocked by permissions policy in embedded / cross-origin / insecure contexts
// (e.g. an app previewed through a tunnel or iframe), and an unguarded
// navigator.clipboard.writeText() there becomes an unhandled promise rejection.
// Returns whether the copy succeeded.
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Clipboard API present but blocked — fall through to the legacy path.
  }

  try {
    if (typeof document === 'undefined') return false
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '-9999px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
