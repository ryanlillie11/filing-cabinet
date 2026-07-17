/**
 * Logs the full error server-side (visible in Vercel's function logs, not to
 * the client) and returns a generic message safe to send in an HTTP response.
 * Use this instead of echoing `error.message` / `String(err)` back to the
 * browser, which can leak internal details (library errors, resource IDs).
 */
export function serverError(context: string, err: unknown): { error: string } {
  console.error(`[${context}]`, err);
  return { error: "Something went wrong on our end. Please try again." };
}
