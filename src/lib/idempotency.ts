/** Keeps the key for an identical payload, including after an ambiguous network failure. */
export function createApplicationRequest(newKey: () => string = () => crypto.randomUUID()) {
  let previousPayload = ''
  let key = ''
  return {
    keyFor(payload: unknown) {
      const serialized = JSON.stringify(payload)
      if (serialized !== previousPayload || !key) { previousPayload = serialized; key = newKey() }
      return key
    },
    clear() { previousPayload = ''; key = '' },
  }
}
