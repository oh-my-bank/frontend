import type { Role } from '../types'

/** Only return an internal destination; a new customer has no preexisting private records. */
export function destinationAfterAuthentication(
  redirect: string | null,
  role: Role,
  registering = false,
) {
  if (role !== 'CUSTOMER') return '/staff'
  if (registering) return '/'
  if (
    !redirect?.startsWith('/') ||
    redirect.startsWith('//') ||
    /[\\\u0000-\u0020\u007f]/.test(redirect)
  )
    return '/'
  return redirect
}
