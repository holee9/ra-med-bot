// @MX:ANCHOR PubMed E-utilities client — external integration boundary.
// @MX:REASON Sole network entry point to NCBI. Rate-limit discipline and XML
// parsing live here; downstream appraisal/citation modules depend on the
// PubMedArticle shape returned by searchPubMed().
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-016~022, REQ-CER-025)
//
// PubMed E-utilities API client. Uses Node.js built-in fetch and parses the
// efetch XML response with lightweight string/regex extraction (no xml2js
// dependency). Errors return an empty array and are logged to console.error.

export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  authors: string[]; // "LastName FM" format
  journal: string;
  year: number;
  volume?: string;
  pages?: string;
}

const ESEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const EFETCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';

// REQ-CER-016: default to >=50 abstracts per search.
const DEFAULT_MAX_RESULTS = 50;

// REQ-CER-025: NCBI permits 3 requests/sec without an API key. A 340ms delay
// between sequential network calls keeps us safely under the limit.
const RATE_LIMIT_DELAY_MS = 340;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Search PubMed and return parsed article metadata + abstracts.
 *
 * Two-step E-utilities flow: esearch resolves the query to a list of PMIDs,
 * then efetch retrieves full records for those PMIDs in a single batch call.
 * Returns an empty array on any network/parse error (logged, never thrown).
 */
export async function searchPubMed(
  query: string,
  maxResults: number = DEFAULT_MAX_RESULTS,
): Promise<PubMedArticle[]> {
  if (!query.trim()) {
    return [];
  }

  try {
    const pmids = await esearch(query, maxResults);
    if (pmids.length === 0) {
      return [];
    }

    // Rate-limit spacing between the esearch and efetch network calls.
    await delay(RATE_LIMIT_DELAY_MS);

    const xml = await efetch(pmids);
    return parseArticlesXml(xml);
  } catch (error) {
    console.error('[pubmed-client] searchPubMed failed:', error);
    return [];
  }
}

async function esearch(query: string, maxResults: number): Promise<string[]> {
  const url = new URL(ESEARCH_URL);
  url.searchParams.set('db', 'pubmed');
  url.searchParams.set('term', query);
  url.searchParams.set('retmax', String(maxResults));
  url.searchParams.set('retmode', 'json');

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`esearch HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    esearchresult?: { idlist?: string[] };
  };
  return data.esearchresult?.idlist ?? [];
}

async function efetch(pmids: string[]): Promise<string> {
  const url = new URL(EFETCH_URL);
  url.searchParams.set('db', 'pubmed');
  url.searchParams.set('id', pmids.join(','));
  url.searchParams.set('retmode', 'xml');

  const res = await fetch(url, { headers: { Accept: 'application/xml' } });
  if (!res.ok) {
    throw new Error(`efetch HTTP ${res.status}`);
  }
  return res.text();
}

// ---------------------------------------------------------------------------
// XML parsing — deliberate, dependency-free extraction over PubmedArticle nodes.
// ---------------------------------------------------------------------------

function parseArticlesXml(xml: string): PubMedArticle[] {
  const articles: PubMedArticle[] = [];
  // Split on each <PubmedArticle> record so per-article extraction is scoped.
  const blocks = xml.split('<PubmedArticle>').slice(1);

  for (const block of blocks) {
    const record = block.split('</PubmedArticle>')[0] ?? block;
    const article = parseSingleArticle(record);
    if (article) {
      articles.push(article);
    }
  }

  return articles;
}

function parseSingleArticle(record: string): PubMedArticle | null {
  const pmid = matchTag(record, 'PMID');
  if (!pmid) {
    return null;
  }

  const title = stripTags(matchTag(record, 'ArticleTitle') ?? '');
  const abstract = extractAbstract(record);
  const authors = extractAuthors(record);
  const journal = stripTags(matchTag(record, 'Title') ?? '');
  const year = extractYear(record);
  const volume = matchTag(record, 'Volume') ?? undefined;
  const pages = matchTag(record, 'MedlinePgn') ?? undefined;

  return {
    pmid: decodeEntities(pmid.trim()),
    title: decodeEntities(title),
    abstract: decodeEntities(abstract),
    authors,
    journal: decodeEntities(journal),
    year,
    volume: volume ? decodeEntities(volume.trim()) : undefined,
    pages: pages ? decodeEntities(pages.trim()) : undefined,
  };
}

/** Match the inner text of the first occurrence of a simple XML tag. */
function matchTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const m = xml.match(re);
  return m?.[1] ?? null;
}

/** Match the inner text of every occurrence of a simple XML tag. */
function matchAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
  const results: string[] = [];
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((m = re.exec(xml)) !== null) {
    if (m[1] !== undefined) {
      results.push(m[1]);
    }
  }
  return results;
}

/**
 * Abstract text may be split across multiple <AbstractText> elements (e.g.
 * Background / Methods / Results / Conclusions). Concatenate them in order.
 */
function extractAbstract(record: string): string {
  const parts = matchAllTags(record, 'AbstractText').map((p) => stripTags(p).trim());
  return parts.filter(Boolean).join(' ');
}

/**
 * Build "LastName FM" author strings from <Author> nodes. Authors lacking a
 * LastName (e.g. CollectiveName only) are skipped.
 */
function extractAuthors(record: string): string[] {
  const authors: string[] = [];
  for (const node of matchAllTags(record, 'Author')) {
    const last = matchTag(node, 'LastName');
    if (!last) {
      continue;
    }
    const initials = matchTag(node, 'Initials');
    const name = initials ? `${last.trim()} ${initials.trim()}` : last.trim();
    authors.push(decodeEntities(name));
  }
  return authors;
}

/**
 * Resolve the publication year. Prefers <PubDate><Year>; falls back to the
 * first 4-digit run inside <MedlineDate>. Returns 0 when no year is present.
 */
function extractYear(record: string): number {
  const pubDate = matchTag(record, 'PubDate');
  if (pubDate) {
    const year = matchTag(pubDate, 'Year');
    if (year) {
      const parsed = Number.parseInt(year.trim(), 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    const medlineDate = matchTag(pubDate, 'MedlineDate');
    if (medlineDate) {
      const m = medlineDate.match(/\d{4}/);
      if (m) {
        return Number.parseInt(m[0], 10);
      }
    }
  }
  return 0;
}

/** Remove any nested XML/HTML markup, leaving plain text. */
function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, '').trim();
}

/** Decode the small set of XML entities NCBI emits in text content. */
function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
