import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface TicketCTAProps {
  ticketId?: string;
}

export function TicketCTA({ ticketId }: TicketCTAProps) {
  const t = useTranslations('impact');

  if (!ticketId) {
    return null;
  }

  return (
    <div data-testid="ticket-cta" className="mt-6">
      <Link
        href={`/inbox/${ticketId}`}
        target="_blank"
        className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        {t('result.ticketCta', { ticketId })}
      </Link>
    </div>
  );
}
