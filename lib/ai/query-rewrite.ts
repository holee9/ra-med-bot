// @MX:ANCHOR Query rewrite — rule-based acronym expansion for FDA corpus retrieval.
// @MX:REASON Called by consult.ts for every query before hybrid search.
// Expanding acronyms dramatically improves retrieval recall for FDA regulatory docs.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-013)

// FDA regulatory acronym lookup table — at least 20 acronyms required by REQ-CHAT-013.
const FDA_ACRONYMS: Record<string, string> = {
  '510(k)': '510(k) premarket notification',
  QSR: 'QSR quality system regulation',
  PMA: 'PMA premarket approval',
  IDE: 'IDE investigational device exemption',
  GMP: 'GMP good manufacturing practice',
  CAPA: 'CAPA corrective and preventive action',
  DHF: 'DHF design history file',
  DMR: 'DMR device master record',
  DHR: 'DHR device history record',
  MDR: 'MDR medical device reporting',
  CFR: 'CFR code of federal regulations',
  FDA: 'FDA food and drug administration',
  UDI: 'UDI unique device identification',
  GUDID: 'GUDID global unique device identification database',
  HDE: 'HDE humanitarian device exemption',
  PMCF: 'PMCF post-market clinical follow-up',
  EUMDR: 'EUMDR european union medical device regulation',
  ISO: 'ISO international organization for standardization',
  IEC: 'IEC international electrotechnical commission',
  SOP: 'SOP standard operating procedure',
  OTC: 'OTC over the counter',
  IVD: 'IVD in vitro diagnostic',
  PMDA: 'PMDA pharmaceuticals and medical devices agency',
  MFDS: 'MFDS ministry of food and drug safety',
  RAB: 'RAB regulatory affairs body',
};

// Korean → English keyword expansion map for ko locale.
const KO_EN_KEYWORDS: Record<string, string> = {
  의료기기: 'medical device',
  등급: 'classification class',
  허가: 'approval clearance',
  인증: 'certification',
  품질: 'quality',
  임상: 'clinical',
  시험: 'test evaluation',
  규제: 'regulation regulatory',
  제출: 'submission filing',
  심사: 'review evaluation',
  신고: 'notification registration',
};

/**
 * Rewrite a query by expanding FDA acronyms and adding Korean-English mixed keywords.
 * This is a pure synchronous function — no LLM call is made.
 *
 * @param question - Original user question
 * @param locale - 'ko' | 'en'
 * @param intent - Classified intent (unused in Phase 2 beyond type checking)
 * @returns Rewritten query string
 */
export function rewriteQuery(
  question: string,
  locale: 'ko' | 'en',
  _intent: 'regulation-lookup' | 'comparison' | 'general',
): string {
  let rewritten = question;
  const addedTerms: string[] = [];

  // Expand all known acronyms found in the question.
  // We use a custom boundary that only requires a word-boundary on the side
  // where the acronym starts/ends with a word character. This handles tokens
  // like `510(k)` whose final char is `)` and would otherwise never match
  // a trailing `\b`.
  for (const [acronym, expansion] of Object.entries(FDA_ACRONYMS)) {
    const escaped = acronym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const startsWithWord = /^\w/.test(acronym);
    const endsWithWord = /\w$/.test(acronym);
    const pattern = `${startsWithWord ? '\\b' : '(?:^|\\W)'}${escaped}${endsWithWord ? '\\b' : '(?=$|\\W)'}`;
    const regex = new RegExp(pattern, 'gi');
    if (regex.test(question)) {
      // Replace only if the expanded form is not already present.
      const expandedBody = expansion.replace(new RegExp(`^${escaped} `, 'i'), '');
      if (!rewritten.toLowerCase().includes(expandedBody.toLowerCase())) {
        // Reset lastIndex; gi flag keeps state across .test() calls.
        regex.lastIndex = 0;
        rewritten = rewritten.replace(regex, (match) => {
          // Preserve any leading non-word that we matched via (?:^|\W).
          if (!startsWithWord && match.length > acronym.length) {
            return match.charAt(0) + expansion;
          }
          return expansion;
        });
      }
    }
  }

  // Add Korean-English mixed keywords for ko locale.
  if (locale === 'ko') {
    for (const [ko, en] of Object.entries(KO_EN_KEYWORDS)) {
      if (question.includes(ko) && !rewritten.includes(en)) {
        addedTerms.push(en);
      }
    }
  }

  if (addedTerms.length > 0) {
    rewritten = `${rewritten} ${addedTerms.join(' ')}`;
  }

  return rewritten;
}
