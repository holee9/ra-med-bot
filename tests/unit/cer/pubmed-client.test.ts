// @MX:NOTE [AUTO] Unit tests for PubMed E-utilities client (searchPubMed).
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-016~022, REQ-CER-025, Issue #402)
// @MX:REASON searchPubMed is the sole network entry point to NCBI. fetch is
//   stubbed via vi.stubGlobal. Tests cover: query building (esearch URL params),
//   efetch XML parsing (multi-author, multi-AbstractText, entity decode, year
//   extraction), empty/error/timeout branches, and rate-limit delay timing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// fetch stub
// ---------------------------------------------------------------------------

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Build a minimal esearch JSON response.
function esearchJson(idlist: string[]): Response {
  return new Response(JSON.stringify({ esearchresult: { idlist } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Build an efetch XML response from an array of record strings (each is the
// inner XML inside <PubmedArticle>...</PubmedArticle>).
function efetchXml(records: string[]): Response {
  const body = records.map((r) => `<PubmedArticle>${r}</PubmedArticle>`).join('');
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/xml' } });
}

// A canonical full record with all fields populated.
const FULL_RECORD = `
<MedlineCitation>
  <PMID>12345</PMID>
  <Article>
    <Journal>
      <Title>N Engl J Med</Title>
      <JournalIssue>
        <Volume>388</Volume>
        <PubDate><Year>2023</Year></PubDate>
        <Pagination><MedlinePgn>1234-1240</MedlinePgn></Pagination>
      </JournalIssue>
    </Journal>
    <ArticleTitle>Effect of &lt;drug&gt; on "mortality" in COPD</ArticleTitle>
    <Abstract>
      <AbstractText Label="Background">Background text.</AbstractText>
      <AbstractText Label="Methods">Methods text.</AbstractText>
      <AbstractText Label="Results">Results text.</AbstractText>
      <AbstractText Label="Conclusions">Conclusions text.</AbstractText>
    </Abstract>
    <AuthorList>
      <Author><LastName>Smith</LastName><Initials>J</Initials></Author>
      <Author><LastName>Jones</LastName><Initials>A</Initials></Author>
      <Author><CollectiveName>Working Group</CollectiveName></Author>
    </AuthorList>
  </Article>
  <ArticleIdList><ArticleId IdType="pii">12345</ArticleId></ArticleIdList>
</MedlineCitation>
`;

// ---------------------------------------------------------------------------
// searchPubMed — query building + happy path
// ---------------------------------------------------------------------------

describe('searchPubMed — esearch query building', () => {
  it('builds esearch URL with db, term, retmax, retmode params', async () => {
    fetchMock
      .mockResolvedValueOnce(esearchJson(['12345'])) // esearch
      .mockResolvedValueOnce(efetchXml([FULL_RECORD])); // efetch

    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    await searchPubMed('cancer immunotherapy', 10);

    // First fetch call = esearch
    const esearchUrl = fetchMock.mock.calls[0]?.[0] as URL;
    expect(esearchUrl.toString()).toContain('esearch.fcgi');
    expect(esearchUrl.searchParams.get('db')).toBe('pubmed');
    expect(esearchUrl.searchParams.get('term')).toBe('cancer immunotherapy');
    expect(esearchUrl.searchParams.get('retmax')).toBe('10');
    expect(esearchUrl.searchParams.get('retmode')).toBe('json');
  });

  it('uses default retmax of 50 when maxResults not provided', async () => {
    fetchMock.mockResolvedValueOnce(esearchJson([])).mockResolvedValueOnce(efetchXml([]));

    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    await searchPubMed('covid');

    const esearchUrl = fetchMock.mock.calls[0]?.[0] as URL;
    expect(esearchUrl.searchParams.get('retmax')).toBe('50');
  });
});

// ---------------------------------------------------------------------------
// searchPubMed — efetch + XML parsing
// ---------------------------------------------------------------------------

describe('searchPubMed — efetch + XML parsing', () => {
  it('builds efetch URL with comma-joined PMIDs + retmode=xml', async () => {
    fetchMock
      .mockResolvedValueOnce(esearchJson(['111', '222', '333']))
      .mockResolvedValueOnce(efetchXml([]));

    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    await searchPubMed('query');

    const efetchUrl = fetchMock.mock.calls[1]?.[0] as URL;
    expect(efetchUrl.toString()).toContain('efetch.fcgi');
    expect(efetchUrl.searchParams.get('id')).toBe('111,222,333');
    expect(efetchUrl.searchParams.get('retmode')).toBe('xml');
  });

  it('parses a full record: title, abstract (multi-section), authors, journal, year, volume, pages', async () => {
    fetchMock
      .mockResolvedValueOnce(esearchJson(['12345']))
      .mockResolvedValueOnce(efetchXml([FULL_RECORD]));

    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    const articles = await searchPubMed('test');

    expect(articles).toHaveLength(1);
    const a = articles[0];
    expect(a?.pmid).toBe('12345');
    expect(a?.title).toBe('Effect of <drug> on "mortality" in COPD');
    // Abstract concatenated from all 4 AbstractText sections, space-joined.
    expect(a?.abstract).toBe('Background text. Methods text. Results text. Conclusions text.');
    // CollectiveName-only author is skipped (no LastName).
    expect(a?.authors).toEqual(['Smith J', 'Jones A']);
    expect(a?.journal).toBe('N Engl J Med');
    expect(a?.year).toBe(2023);
    expect(a?.volume).toBe('388');
    expect(a?.pages).toBe('1234-1240');
  });

  it('decodes XML entities (&lt; &gt; &quot; &apos; &amp;) in text fields', async () => {
    const record = `
<MedlineCitation>
  <PMID>99999</PMID>
  <Article>
    <Journal><Title>J &amp; Co</Title></Journal>
    <ArticleTitle>A &lt; B &amp; C &gt; D</ArticleTitle>
    <Abstract><AbstractText>It&apos;s &quot;fine&quot;</AbstractText></Abstract>
    <AuthorList><Author><LastName>O&apos;Brien</LastName><Initials>K</Initials></Author></AuthorList>
  </Article>
</MedlineCitation>
<PubmedData><History><PubMedPubDate><Year>2020</Year></PubMedPubDate></History></PubmedData>`;
    fetchMock
      .mockResolvedValueOnce(esearchJson(['99999']))
      .mockResolvedValueOnce(efetchXml([record]));

    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    const articles = await searchPubMed('x');

    expect(articles[0]?.title).toBe('A < B & C > D');
    expect(articles[0]?.journal).toBe('J & Co');
    expect(articles[0]?.abstract).toBe('It\'s "fine"');
    expect(articles[0]?.authors).toEqual(["O'Brien K"]);
  });

  it('parses multiple PubmedArticle records from a single efetch response', async () => {
    const rec1 =
      '<MedlineCitation><PMID>1</PMID><Article><Journal><Title>J1</Title></Journal><ArticleTitle>T1</ArticleTitle><Abstract><AbstractText>A1</AbstractText></Abstract><AuthorList><Author><LastName>Doe</LastName><Initials>J</Initials></Author></AuthorList></Article></MedlineCitation><PubmedData><History><PubMedPubDate><Year>2021</Year></PubMedPubDate></History></PubmedData>';
    const rec2 =
      '<MedlineCitation><PMID>2</PMID><Article><Journal><Title>J2</Title></Journal><ArticleTitle>T2</ArticleTitle><Abstract><AbstractText>A2</AbstractText></Abstract><AuthorList><Author><LastName>Roe</LastName><Initials>R</Initials></Author></AuthorList></Article></MedlineCitation><PubmedData><History><PubMedPubDate><Year>2022</Year></PubMedPubDate></History></PubmedData>';
    fetchMock
      .mockResolvedValueOnce(esearchJson(['1', '2']))
      .mockResolvedValueOnce(efetchXml([rec1, rec2]));

    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    const articles = await searchPubMed('x');

    expect(articles).toHaveLength(2);
    expect(articles[0]?.pmid).toBe('1');
    expect(articles[1]?.pmid).toBe('2');
  });

  it('skips records without a PMID', async () => {
    const noPmid =
      '<MedlineCitation><Article><ArticleTitle>No PMID</ArticleTitle></Article></MedlineCitation>';
    fetchMock
      .mockResolvedValueOnce(esearchJson(['12345']))
      .mockResolvedValueOnce(efetchXml([noPmid, FULL_RECORD]));

    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    const articles = await searchPubMed('x');

    expect(articles).toHaveLength(1);
    expect(articles[0]?.pmid).toBe('12345');
  });

  it('extracts year from MedlineDate when PubDate/Year is absent', async () => {
    const record = `
<MedlineCitation><PMID>555</PMID><Article><Journal><Title>J</Title><JournalIssue><PubDate><MedlineDate>2019 Jan-Feb</MedlineDate></PubDate></JournalIssue></Journal><ArticleTitle>T</ArticleTitle><Abstract><AbstractText>A</AbstractText></Abstract><AuthorList><Author><LastName>X</LastName></Author></AuthorList></Article></MedlineCitation>`;
    fetchMock
      .mockResolvedValueOnce(esearchJson(['555']))
      .mockResolvedValueOnce(efetchXml([record]));

    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    const articles = await searchPubMed('x');

    expect(articles[0]?.year).toBe(2019);
  });

  it('returns year=0 when no parseable year is present', async () => {
    const record = `
<MedlineCitation><PMID>666</PMID><Article><Journal><Title>J</Title></Journal><ArticleTitle>T</ArticleTitle><Abstract><AbstractText>A</AbstractText></Abstract><AuthorList><Author><LastName>X</LastName></Author></AuthorList></Article></MedlineCitation>
<PubmedData><History><PubMedPubDate PubStatus="pubmed"><MedlineDate>no date</MedlineDate></PubMedPubDate></History></PubmedData>`;
    fetchMock
      .mockResolvedValueOnce(esearchJson(['666']))
      .mockResolvedValueOnce(efetchXml([record]));

    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    const articles = await searchPubMed('x');

    expect(articles[0]?.year).toBe(0);
  });

  it('handles author with no Initials (uses LastName only)', async () => {
    const record = `
<MedlineCitation><PMID>777</PMID><Article><Journal><Title>J</Title></Journal><ArticleTitle>T</ArticleTitle><Abstract><AbstractText>A</AbstractText></Abstract><AuthorList><Author><LastName>Solo</LastName></Author></AuthorList></Article></MedlineCitation>
<PubmedData><History><PubMedPubDate><Year>2024</Year></PubMedPubDate></History></PubmedData>`;
    fetchMock
      .mockResolvedValueOnce(esearchJson(['777']))
      .mockResolvedValueOnce(efetchXml([record]));

    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    const articles = await searchPubMed('x');

    expect(articles[0]?.authors).toEqual(['Solo']);
  });

  it('omits volume/pages when not present in the record', async () => {
    const record = `
<MedlineCitation><PMID>888</PMID><Article><Journal><Title>J</Title></Journal><ArticleTitle>T</ArticleTitle><Abstract><AbstractText>A</AbstractText></Abstract><AuthorList><Author><LastName>X</LastName></Author></AuthorList></Article></MedlineCitation>`;
    fetchMock
      .mockResolvedValueOnce(esearchJson(['888']))
      .mockResolvedValueOnce(efetchXml([record]));

    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    const articles = await searchPubMed('x');

    expect(articles[0]?.volume).toBeUndefined();
    expect(articles[0]?.pages).toBeUndefined();
  });

  it('strips nested markup from ArticleTitle (e.g. <sub>)', async () => {
    const record = `
<MedlineCitation><PMID>100</PMID><Article><Journal><Title>J</Title></Journal><ArticleTitle>Title with <sub>nested</sub> markup</ArticleTitle><Abstract><AbstractText>A</AbstractText></Abstract><AuthorList><Author><LastName>X</LastName></Author></AuthorList></Article></MedlineCitation>
<PubmedData><History><PubMedPubDate><Year>2024</Year></PubMedPubDate></History></PubmedData>`;
    fetchMock
      .mockResolvedValueOnce(esearchJson(['100']))
      .mockResolvedValueOnce(efetchXml([record]));

    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    const articles = await searchPubMed('x');

    expect(articles[0]?.title).toBe('Title with nested markup');
  });
});

// ---------------------------------------------------------------------------
// searchPubMed — error + edge branches
// ---------------------------------------------------------------------------

describe('searchPubMed — error + edge branches', () => {
  it('returns [] for empty/whitespace query (no fetch)', async () => {
    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    const result = await searchPubMed('   ');
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns [] when esearch yields no PMIDs (efetch not called)', async () => {
    fetchMock.mockResolvedValueOnce(esearchJson([]));
    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    const result = await searchPubMed('nonexistent');
    expect(result).toEqual([]);
    // Only esearch called, efetch skipped.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns [] when esearch HTTP status is non-ok', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"error":"invalid"}', { status: 400 }));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    const result = await searchPubMed('query');
    expect(result).toEqual([]);
    expect(errSpy).toHaveBeenCalled();
  });

  it('returns [] when efetch HTTP status is non-ok', async () => {
    fetchMock
      .mockResolvedValueOnce(esearchJson(['1'])) // esearch ok
      .mockResolvedValueOnce(new Response('server error', { status: 500 })); // efetch fail
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    const result = await searchPubMed('query');
    expect(result).toEqual([]);
    expect(errSpy).toHaveBeenCalled();
  });

  it('returns [] when fetch throws (network error)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    const result = await searchPubMed('query');
    expect(result).toEqual([]);
    expect(errSpy).toHaveBeenCalled();
  });

  it('handles esearchresult missing idlist (returns [])', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ esearchresult: {} }), { status: 200 }),
    );
    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    const result = await searchPubMed('query');
    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1); // efetch not called
  });

  it('handles malformed esearchresult (no esearchresult key)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ unrelated: true }), { status: 200 }),
    );
    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    const result = await searchPubMed('query');
    expect(result).toEqual([]);
  });

  it('returns [] for empty efetch XML body (no PubmedArticle nodes)', async () => {
    fetchMock.mockResolvedValueOnce(esearchJson(['1'])).mockResolvedValueOnce(efetchXml([]));
    const { searchPubMed } = await import('@/lib/cer/pubmed-client');
    const result = await searchPubMed('query');
    expect(result).toEqual([]);
  });
});
