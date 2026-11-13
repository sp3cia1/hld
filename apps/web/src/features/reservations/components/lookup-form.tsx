import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Opens a reservation by its number. Any number goes to the reservation page, which says if it is not found. */
export function LookupForm() {
  const navigate = useNavigate();
  const [typed, setTyped] = useState('');
  // People copy numbers with spaces in them ("482 193 7560"), so spaces are dropped.
  const reference = typed.replace(/\s/g, '');

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reference) void navigate(`/reservations/${encodeURIComponent(reference)}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <div className="space-y-2">
        <Label htmlFor="reservation-number">Reservation number</Label>
        <Input
          id="reservation-number"
          inputMode="numeric"
          autoComplete="off"
          placeholder="10 digits"
          className="w-48"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      </div>
      <Button type="submit" variant="outline" disabled={!reference}>
        Open
      </Button>
    </form>
  );
}