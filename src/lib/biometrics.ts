import * as LocalAuthentication from 'expo-local-authentication';

/** Whether this device has a fingerprint/face sensor with something enrolled. */
export async function biometricsAvailable() {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** Asks for the owner's fingerprint (or face). Resolves true when it matched. */
export async function confirmOwner(promptMessage: string) {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Cancel' });
    return result.success;
  } catch {
    return false;
  }
}
