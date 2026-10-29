/** Browsers have no fingerprint API the app can use, so the vault falls back to a reset. */
export async function biometricsAvailable() {
  return false;
}

export async function confirmOwner(_promptMessage: string) {
  return false;
}
