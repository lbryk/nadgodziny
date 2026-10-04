import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-md place-items-center gap-4 py-24 text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Compass className="size-8" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Nie ma takiej strony</h1>
      <p className="text-muted">Sprawdź adres albo wróć do kalkulatora.</p>
      <Link to="/">
        <Button variant="primary">Wróć do kalkulatora</Button>
      </Link>
    </div>
  );
}
