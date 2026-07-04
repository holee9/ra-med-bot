-- 0106: approved_answers.esig_signature — §11.70 signature-record binding (#321 C-1)
-- Stores a SHA-256 digest binding the approved record to the ESIG act.
-- Canonical input: { ticketId, approverId, finalAnswer, citations }.
-- Verification recomputes the digest; any post-signature mutation invalidates it.
ALTER TABLE approved_answers
  ADD COLUMN IF NOT EXISTS esig_signature text;
