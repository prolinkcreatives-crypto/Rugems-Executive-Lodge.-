// Server-only. Never import this from client-rendered code — it reads
// OQUMAIL_API_KEY, which must never reach the browser bundle.
//
// OquMail does not support SMTP for external senders; sending is REST-only
// (confirmed via oqumail.com/product: "IMAP, POP3 and SMTP for external
// clients are not currently supported. Programmatic sending is available
// through the email API."). The endpoint, auth scheme, and request shape
// below are taken directly from OquMail's own published example — no
// invented fields. `cc` and `html` are not shown in what's publicly
// documented, so callers needing multiple recipients should list them all
// in `to`; verify against the account's actual API reference before
// assuming either is supported.

const OQUMAIL_ENDPOINT = "https://api.oqumail.com/api/v1/emails";

export interface SendEmailInput {
  /** One or more recipient addresses. */
  to: string[];
  subject: string;
  /** Plain-text body. OquMail's confirmed example only shows `text`. */
  text: string;
  /** Display name for the sending mailbox, e.g. "Rugems Executive Lodge". */
  fromName?: string;
}

export type SendEmailResult = { ok: true } | { ok: false; error: string };

/**
 * Sends one transactional email via OquMail's REST API.
 * Never throws — always resolves to a result, so a failure here can never
 * crash or fail whatever called it. Never logs the API key.
 */
export async function sendOquMailEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.OQUMAIL_API_KEY;
  if (!apiKey) {
    console.error("[oqumail] OQUMAIL_API_KEY is not set — email not sent.");
    return { ok: false, error: "Email service is not configured." };
  }

  let response: Response;
  try {
    response = await fetch(OQUMAIL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: input.to,
        subject: input.subject,
        text: input.text,
        fromName: input.fromName,
      }),
    });
  } catch (err) {
    // Network-level failure (DNS, timeout, connection reset, etc).
    console.error("[oqumail] send threw:", err instanceof Error ? err.message : String(err));
    return { ok: false, error: "Network error contacting OquMail." };
  }

  if (!response.ok) {
    // Log the response for diagnostics — status + body only, never the
    // Authorization header or the key itself.
    const body = await response.text().catch(() => "");
    console.error(`[oqumail] send failed: HTTP ${response.status} — ${body.slice(0, 500)}`);
    return { ok: false, error: `OquMail responded with HTTP ${response.status}` };
  }

  return { ok: true };
}
