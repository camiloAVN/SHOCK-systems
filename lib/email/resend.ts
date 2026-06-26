import { Resend } from 'resend'

let client: Resend | null = null

/**
 * Lazily instantiate the Resend client.
 *
 * Creating `new Resend(process.env.RESEND_API_KEY)` at module top level makes
 * `next build` fail during "Collecting page data" when the key isn't present in
 * the build environment (the constructor throws "Missing API key"). Instantiating
 * on first use defers that to request time, when the runtime env is available.
 */
export function getResend(): Resend {
  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY)
  }
  return client
}
