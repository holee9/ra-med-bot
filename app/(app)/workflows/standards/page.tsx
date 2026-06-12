import { StandardsForm } from './_components/StandardsForm';

export const metadata = { title: 'Standards Tracker — Regula' };

export default function StandardsPage() {
  return (
    <main className="container mx-auto max-w-4xl py-8 px-4">
      <h1 className="text-2xl font-bold mb-2">Harmonized Standards Tracker</h1>
      <p className="text-muted-foreground mb-6">
        Map applicable standards for your device and identify FDA-recognized / EU-harmonized
        requirements.
      </p>
      <StandardsForm />
    </main>
  );
}
