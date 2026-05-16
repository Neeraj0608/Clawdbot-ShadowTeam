import prisma from '@/lib/prisma';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Opportunities | TCET Centre of Excellence',
  description:
    'Discover the latest internships, hackathons, workshops, grants, and competitions curated automatically from TCET, Unstop, Internshala, and grant databases.',
};

// Revalidate every 4 hours (matches scraper cadence)
export const revalidate = 14400;

const SOURCE_LABEL: Record<string, string> = {
  TCET: 'TCET',
  UNSTOP: 'Unstop',
  INTERNSHALA: 'Internshala',
  GRANT_DB: 'Grant DB',
  MANUAL: 'Manual',
  LINKEDIN: 'LinkedIn',
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  INTERNSHIP:  { bg: 'bg-[#e6f4ec]',  text: 'text-[#0b6b2e]' },
  HACKATHON:   { bg: 'bg-[#eef0f5]',  text: 'text-[#002155]' },
  WORKSHOP:    { bg: 'bg-[#fff3e0]',  text: 'text-[#8c4f00]' },
  GRANT:       { bg: 'bg-[#f0e6ff]',  text: 'text-[#5a0090]' },
  PLACEMENT:   { bg: 'bg-[#e6f0ff]',  text: 'text-[#003a8c]' },
  COMPETITION: { bg: 'bg-[#fff0f0]',  text: 'text-[#8b0000]' },
};

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; source?: string; q?: string }>;
}) {
  const params = await searchParams;
  const typeFilter = params.type?.toUpperCase();
  const sourceFilter = params.source?.toUpperCase();
  const query = params.q?.trim() ?? '';

  const opportunities = await prisma.scrapedOpportunity.findMany({
    where: {
      isActive: true,
      OR: [
        { deadline: null },
        { deadline: { gte: new Date() } }
      ],
      ...(typeFilter ? { type: typeFilter as never } : {}),
      ...(sourceFilter ? { source: sourceFilter as never } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query } },
              { description: { contains: query } },
              { tags: { contains: query } },
              { company: { contains: query } },
            ],
          }
        : {}),
    },
    orderBy: [{ deadline: 'asc' }, { scrapedAt: 'desc' }],
    take: 60,
  });

  const types = ['INTERNSHIP', 'HACKATHON', 'WORKSHOP', 'GRANT', 'PLACEMENT', 'COMPETITION'];
  const sources = ['TCET', 'UNSTOP', 'INTERNSHALA', 'GRANT_DB', 'LINKEDIN'];

  return (
    <main className="max-w-[1560px] mx-auto px-4 sm:px-6 md:px-12 py-8 min-h-screen pt-[120px] sm:pt-[130px]">
      {/* Header */}
      <div className="border-l-4 border-[#002155] pl-5 mb-8">
        <h1 className="text-3xl sm:text-4xl font-headline font-bold text-[#002155] tracking-tight">
          Opportunities
        </h1>
        <p className="text-xs uppercase tracking-widest text-[#8c4f00] mt-1">
          Auto-updated from TCET · Unstop · Internshala · Grant Databases
        </p>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 mb-8 items-end">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-[#747782] uppercase tracking-widest mb-1">
            Search
          </label>
          <input
            name="q"
            defaultValue={query}
            placeholder="Keyword, company, skill…"
            className="w-full border border-[#c4c6d3] bg-white px-3 py-2 text-sm text-[#002155] placeholder:text-[#a0a3b1] focus:outline-none focus:border-[#002155] transition-colors"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-[10px] font-bold text-[#747782] uppercase tracking-widest mb-1">
            Type
          </label>
          <select
            name="type"
            defaultValue={typeFilter ?? ''}
            className="border border-[#c4c6d3] bg-white px-3 py-2 text-sm text-[#002155] focus:outline-none focus:border-[#002155]"
          >
            <option value="">All Types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Source */}
        <div>
          <label className="block text-[10px] font-bold text-[#747782] uppercase tracking-widest mb-1">
            Source
          </label>
          <select
            name="source"
            defaultValue={sourceFilter ?? ''}
            className="border border-[#c4c6d3] bg-white px-3 py-2 text-sm text-[#002155] focus:outline-none focus:border-[#002155]"
          >
            <option value="">All Sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="px-5 py-2 bg-[#002155] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#003080] transition-colors"
        >
          Filter
        </button>

        {(typeFilter || sourceFilter || query) && (
          <Link
            href="/opportunities"
            className="px-5 py-2 border border-[#c4c6d3] text-[#747782] text-xs font-bold uppercase tracking-widest hover:border-[#002155] hover:text-[#002155] transition-colors"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Count */}
      <p className="text-xs text-[#747782] mb-5 uppercase tracking-widest">
        {opportunities.length === 0
          ? 'No opportunities found'
          : `${opportunities.length} opportunit${opportunities.length === 1 ? 'y' : 'ies'} found`}
      </p>

      {/* Grid */}
      {opportunities.length === 0 ? (
        <div className="border border-dashed border-[#c4c6d3] p-10 text-center bg-white">
          <span className="material-symbols-outlined text-[#c4c6d3] text-5xl block mb-3">
            search_off
          </span>
          <p className="text-sm text-[#747782]">
            No opportunities match your filters.
            {' '}
            <Link href="/opportunities" className="text-[#8c4f00] font-bold underline">
              Clear filters
            </Link>
          </p>
          <p className="text-xs text-[#a0a3b1] mt-2">
            The scraper runs every morning at 6 AM and every 4 hours throughout the day.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {opportunities.map((opp) => {
            const typeColor = TYPE_COLORS[opp.type] ?? { bg: 'bg-[#eef0f5]', text: 'text-[#002155]' };
            return (
              <article
                key={opp.id}
                className="border border-[#c4c6d3] bg-white p-5 flex flex-col gap-3 hover:shadow-[0_0_0_2px_#002155] transition-shadow"
              >
                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 ${typeColor.bg} ${typeColor.text}`}
                  >
                    {opp.type.charAt(0) + opp.type.slice(1).toLowerCase()}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#747782] border border-[#c4c6d3] px-2 py-0.5">
                    {SOURCE_LABEL[opp.source] ?? opp.source}
                  </span>
                  {!opp.isVerified && (
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#8c4f00] border border-[#f5d5a0] bg-[#fff8ee] px-2 py-0.5">
                      Unverified
                    </span>
                  )}
                </div>

                {/* Title */}
                <h2 className="font-semibold text-[#002155] text-sm leading-snug line-clamp-2">
                  {opp.title}
                </h2>

                {/* Meta */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#747782]">
                  {opp.company && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">business</span>
                      {opp.company}
                    </span>
                  )}
                  {opp.location && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">location_on</span>
                      {opp.location}
                    </span>
                  )}
                  {opp.stipend && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">payments</span>
                      {opp.stipend}
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-[#434651] line-clamp-3 leading-relaxed">
                  {opp.description}
                </p>

                {/* Tags */}
                {opp.tags && (
                  <div className="flex flex-wrap gap-1">
                    {opp.tags
                      .split(',')
                      .slice(0, 4)
                      .map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] bg-[#f5f4f0] border border-[#e0dfd9] text-[#747782] px-2 py-0.5 font-medium"
                        >
                          {tag.trim()}
                        </span>
                      ))}
                  </div>
                )}

                {/* Footer */}
                <div className="mt-auto pt-3 border-t border-[#f0efe9] flex items-center justify-between">
                  <span className="text-[10px] text-[#747782]">
                    {opp.deadline
                      ? `Deadline: ${dateFormatter.format(opp.deadline)}`
                      : 'No deadline listed'}
                  </span>
                  {opp.registrationLink ? (
                    <a
                      href={opp.registrationLink}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[10px] font-bold text-[#8c4f00] uppercase tracking-widest underline hover:text-[#002155] transition-colors"
                    >
                      Apply →
                    </a>
                  ) : (
                    <span className="text-[10px] text-[#a0a3b1]">No link</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <div className="mt-10 border-t border-[#c4c6d3] pt-6 text-center">
        <p className="text-xs text-[#a0a3b1]">
          Opportunities are scraped automatically every 4 hours.
          Unverified listings are sourced from external platforms and have not been reviewed by TCET.
          Use the AI assistant (bottom-right) to search by voice or ask questions.
        </p>
      </div>
    </main>
  );
}
