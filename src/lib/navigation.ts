import type { Role } from '../types'

/**
 * Only return an internal destination; a new customer has no preexisting private records, so
 * registration continues only to the simulation start screen (with any plan prefill) or `/my`.
 * An administrator returns to the product management screen they were sent away from.
 */
export function destinationAfterAuthentication(
  redirect: string | null,
  role: Role,
  registering = false,
) {
  const internal = isInternalPath(redirect) ? redirect : null
  if (role === 'ADMIN') return internal && isAdminPath(internal) ? internal : '/staff'
  if (role !== 'CUSTOMER') return '/staff'
  if (registering)
    return internal === '/simulation' || internal?.startsWith('/simulation?') ? internal : '/my'
  if (!internal || internal === '/') return '/my'
  return internal
}

export function isAdminPath(path: string) {
  return path === '/admin' || path.startsWith('/admin/')
}

function isInternalPath(path: string | null): path is string {
  return !!path?.startsWith('/') && !path.startsWith('//') && !/[\\\u0000-\u0020\u007f]/.test(path)
}

export function anchorId(hash: string): string | null {
  try {
    return hash.startsWith('#') ? decodeURIComponent(hash.slice(1)) : null
  } catch {
    return null
  }
}
