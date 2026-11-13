import type { QuickRequestField, QuickRequestResult } from '@bh/shared/quick-request';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { getErrorMessage } from '@/lib/error-messages';
import { useQuickRequest } from '../hooks';

/** The form's own names for the fields, in the form's order. */
const LABELS: Record<QuickRequestField, string> = {
  departureAirport: 'From',
  country: 'To',
  startDate: 'First day',
  nights: 'Nights',
  adults: 'Adults',
  childAges: 'Children',
  budgetInr: 'Budget',
};

/** The fields a request can't do without. Children are optional, so a text that doesn't mention them isn't short. */
export const REQUIRED_FIELDS = [
  'departureAirport',
  'country',
  'startDate',
  'nights',
  'adults',
  'budgetInr',
] as const satisfies readonly QuickRequestField[];

/**
 * Quick request (S1): the traveler describes the holiday in their own words, and the form below fills in what the
 * text says. It never builds by itself: the traveler checks the fields and clicks Build. What the text doesn't say,
 * or says in a way that could mean two things, stays for the traveler to fill, with a note saying why.
 */
export function QuickRequestBox({ onRead }: { onRead: (result: QuickRequestResult) => void }) {
  const [text, setText] = useState('');
  const quick = useQuickRequest();
  const result = quick.data?.data;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim() === '') return;
        quick.mutate(text, { onSuccess: ({ data }) => onRead(data) });
      }}
    >
      <Label htmlFor="quick-request">Describe your trip</Label>
      <textarea
        id="quick-request"
        rows={2}
        maxLength={500}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter fills the form; Shift+Enter starts a new line.
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="e.g. 2 adults and a 6-year-old from Bangalore to Japan, 10 to 16 April, budget 3.5 lakh"
        className="w-full min-w-0 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex justify-end">
        <Button type="submit" variant="outline" disabled={quick.isPending || text.trim() === ''}>
          {quick.isPending ? 'Reading…' : 'Fill the form'}
        </Button>
      </div>
      {quick.isError && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(quick.error)}
        </p>
      )}
      {result && <WhatWasRead result={result} />}
    </form>
  );
}

function WhatWasRead({ result }: { result: QuickRequestResult }) {
  const filled = (Object.keys(LABELS) as QuickRequestField[]).filter((field) =>
    field === 'childAges'
      ? result.fields.childAges !== undefined || result.childrenWithoutAges > 0
      : result.fields[field] !== undefined,
  );
  const missing = REQUIRED_FIELDS.filter((field) => result.fields[field] === undefined);

  return (
    <div role="status" className="space-y-2 text-sm">
      {filled.length > 0 ? (
        <p>
          <span className="font-semibold">Filled from your text:</span>{' '}
          {filled.map((field) => LABELS[field]).join(', ')}.
        </p>
      ) : (
        <p className="font-semibold">We couldn't read any of the details. Fill them in below.</p>
      )}
      {filled.length > 0 && missing.length > 0 && (
        <p>
          <span className="font-semibold">Not in your text:</span>{' '}
          {missing.map((field) => LABELS[field]).join(', ')}. Check them below.
        </p>
      )}
      {result.notes.length > 0 && (
        <ul className="space-y-1">
          {result.notes.map((note) => (
            <li
              key={note}
              className="w-fit rounded-md bg-caution px-2 py-1 text-caution-foreground"
            >
              {note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
