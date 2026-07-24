/**
 * Safely loads dynamic modules with retry logic for network glitches and deployment updates.
 */
export async function safeDynamicImport<T>(importFn: () => Promise<T>, retries = 2): Promise<T> {
  try {
    return await importFn()
  } catch (error) {
    const isFetchError =
      error instanceof Error &&
      (error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('Importing a module script failed') ||
        error.message.includes('dynamically imported module'))

    if (isFetchError && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 300 * (3 - retries)))
      return safeDynamicImport(importFn, retries - 1)
    }

    if (isFetchError) {
      throw new Error(
        'Impossibile caricare il modulo dinamico dell\'applicazione. Ciò accade solitamente quando viene pubblicata una nuova versione o la connessione viene interrotta. Ricarica la pagina per risolvere.',
        { cause: error },
      )
    }

    throw error
  }
}
