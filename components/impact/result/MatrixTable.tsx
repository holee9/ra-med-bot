import { useTranslations } from 'next-intl';

export interface MatrixItem {
  level: 'required' | 'conditional' | 'not-required';
  ref: string;
  note: string;
  market: string;
}

interface MatrixTableProps {
  matrix: MatrixItem[];
}

export function MatrixTable({ matrix }: MatrixTableProps) {
  const t = useTranslations('impact');

  const getLevelStyle = (level: MatrixItem['level']) => {
    switch (level) {
      case 'required':
        return 'border-l-4 border-red-500 bg-red-50';
      case 'conditional':
        return 'border-l-4 border-yellow-500 bg-yellow-50';
      case 'not-required':
        return 'border-l-4 border-gray-300 bg-gray-50';
      default:
        return '';
    }
  };

  return (
    <div data-testid="matrix-table" className="w-full">
      <h3 className="text-lg font-semibold mb-4">{t('result.matrixHeader')}</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 text-left font-semibold text-sm">{t('result.market')}</th>
              <th className="px-4 py-2 text-left font-semibold text-sm">{t('result.level')}</th>
              <th className="px-4 py-2 text-left font-semibold text-sm">{t('result.ref')}</th>
              <th className="px-4 py-2 text-left font-semibold text-sm">{t('result.note')}</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((item) => (
              <tr key={`${item.market}-${item.ref}`} className={getLevelStyle(item.level)}>
                <td className="px-4 py-3 text-sm capitalize">{item.market}</td>
                <td className="px-4 py-3 text-sm capitalize">{item.level}</td>
                <td className="px-4 py-3 text-sm">{item.ref}</td>
                <td className="px-4 py-3 text-sm">{item.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
