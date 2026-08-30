/** What the contact card sends, and what it is told back. */
export interface ContactRequest {
  /** The address the studio should reply to. */
  from: string;
  /** What the sender is called. Optional — the form does not insist. */
  name?: string;
  message: string;
  /**
   * The honeypot. A field the stylesheet hides and a person never sees; a bot
   * that fills every input fills this one too. Anything in it means the message
   * is dropped, and the answer is the same 200 a real one gets.
   */
  website?: string;
  /** Which language the card was read in, so the subject is in that language. */
  locale?: string;
}

export interface ContactResponse {
  /** Always true when the status is 200. A refusal arrives as the error envelope. */
  sent: boolean;
}
