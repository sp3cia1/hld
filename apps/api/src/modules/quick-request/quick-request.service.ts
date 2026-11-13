import type { QuickRequestResult } from '@bh/shared/quick-request';
import { getCatalog } from '../catalog/catalog.loader';
import { readRequest, vocabularyFrom, type Vocabulary } from './quick-request.logic';

let vocabulary: Vocabulary | undefined;

/** Reads a holiday described in plain words (S1). The words it knows come from the catalog, gathered once. */
export function readQuickRequest(text: string): QuickRequestResult {
  const catalog = getCatalog();
  vocabulary ??= vocabularyFrom(catalog.destinations, [...catalog.attractions.values()]);
  return readRequest(text, vocabulary);
}
