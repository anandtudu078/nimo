/**
 * Turns an unknown thrown value (usually an axios error) into a message that
 * says whether the server responded or was unreachable — the distinction that
 * used to be swallowed behind an empty state.
 */
export function getErrorMessage(err: any, fallback = 'Please try again.'): string {
  const status = err?.response?.status
  const serverMessage = err?.response?.data?.message
  if (status) {
    return `The server responded with ${status}${serverMessage ? `: ${serverMessage}` : ''}`
  }
  if (err?.request) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  return serverMessage || fallback
}
