import type { Trip } from '@bh/shared/holiday-package';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/error-messages';
import { useExportPackage } from '../hooks';

/**
 * Downloads the package as one JSON file in the shared trip format (§6). The API checks it against every travel
 * rule first. Once booked, the file is the reservation snapshot and is named after the reservation number.
 */
export function ExportButton({ packageId }: { packageId: string }) {
  const exportPackage = useExportPackage();

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        disabled={exportPackage.isPending}
        onClick={() =>
          exportPackage.mutate(packageId, {
            onSuccess: ({ data }) => saveAsJson(data, fileNameFor(data)),
          })
        }
      >
        <Download />
        {exportPackage.isPending ? 'Preparing the file…' : 'Download as JSON'}
      </Button>
      {exportPackage.isError && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(exportPackage.error)}
        </p>
      )}
    </div>
  );
}

/** `holiday-4821937560.json` once booked, otherwise `holiday-<package id>.json`. */
function fileNameFor(trip: Trip): string {
  const reference = trip.items.find((item) => item.booking)?.booking?.reference;
  return `holiday-${reference ?? trip.trip_id}.json`;
}

/** Saves a value as a pretty-printed JSON file through a temporary link, the browser's own download. */
function saveAsJson(value: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Released after the click has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
