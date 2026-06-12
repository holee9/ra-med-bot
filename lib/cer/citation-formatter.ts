// @MX:NOTE Vancouver-style citation formatting for CER literature references.
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-020, REQ-CER-021)

import type { PubMedArticle } from './pubmed-client';

// Vancouver style lists at most the first 6 authors before "et al.".
const MAX_AUTHORS_BEFORE_ET_AL = 6;

/**
 * Format a PubMed article as a Vancouver-style citation.
 *
 * Format: Authors. Title. Journal. Year;Volume:Pages.
 * Example: "Smith J, Jones A. Effect of X on Y. N Engl J Med. 2023;388:1234-1240."
 *
 * If more than 6 authors are present, the first 6 are listed followed by
 * "et al." Missing fields are omitted gracefully (their surrounding
 * punctuation is dropped) so the citation never contains empty segments.
 */
export function formatVancouver(article: PubMedArticle): string {
  const segments: string[] = [];

  const authors = formatAuthors(article.authors);
  if (authors) {
    segments.push(`${authors}.`);
  }

  const title = article.title.trim();
  if (title) {
    // Ensure the title ends with a single period.
    segments.push(title.endsWith('.') ? title : `${title}.`);
  }

  const journal = article.journal.trim();
  if (journal) {
    segments.push(`${journal}.`);
  }

  const tail = formatYearVolumePages(article);
  if (tail) {
    segments.push(tail);
  }

  return segments.join(' ');
}

function formatAuthors(authors: string[]): string {
  const cleaned = authors.map((a) => a.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return '';
  }
  if (cleaned.length > MAX_AUTHORS_BEFORE_ET_AL) {
    return `${cleaned.slice(0, MAX_AUTHORS_BEFORE_ET_AL).join(', ')}, et al`;
  }
  return cleaned.join(', ');
}

/**
 * Compose the "Year;Volume:Pages." tail. Each component is optional:
 * - Year only            -> "2023."
 * - Year + Volume        -> "2023;388."
 * - Year + Volume + Pages -> "2023;388:1234-1240."
 * Volume/Pages without a year are dropped (a Vancouver tail anchors on year).
 */
function formatYearVolumePages(article: PubMedArticle): string {
  if (!article.year || article.year <= 0) {
    return '';
  }

  let tail = String(article.year);
  const volume = article.volume?.trim();
  const pages = article.pages?.trim();

  if (volume) {
    tail += `;${volume}`;
    if (pages) {
      tail += `:${pages}`;
    }
  }

  return `${tail}.`;
}
