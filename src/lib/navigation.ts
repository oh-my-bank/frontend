import type { Role } from '../types'

/** Only return an internal destination; a new customer has no preexisting private records. */
export function destinationAfterAuthentication(
  redirect: string | null,
  role: Role,
  registering = false,
) {
  if (role !== 'CUSTOMER') return '/staff'
  if (registering) return '/my'
  if (redirect === '/') return '/my'
  if (
    !redirect?.startsWith('/') ||
    redirect.startsWith('//') ||
    /[\\\u0000-\u0020\u007f]/.test(redirect)
  )
    return '/my'
  return redirect
}

export function anchorId(hash: string): string | null {
  try {
    return hash.startsWith('#') ? decodeURIComponent(hash.slice(1)) : null
  } catch {
    return null
  }
}
