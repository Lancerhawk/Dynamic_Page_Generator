const pageStore = new Map<string, { html: string; timestamp: number }>();

export function storePage(intentId: string, html: string): void {
  pageStore.set(intentId, {
    html,
    timestamp: Date.now()
  });
}

export function getPage(intentId: string): string | null {
  const page = pageStore.get(intentId);
  return page ? page.html : null;
}

export function clearAllPages(): void {
  pageStore.clear();
}