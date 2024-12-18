// Helper type for credential data
type StoredCredential = {
  id: string;
  publicKey: string;
  walletData: {
    ordPk: string;
    payPk: string;
    name: string;
    createdAt: number;
  };
};

// Add type for multiple stored credentials
type StoredCredentials = {
  [key: string]: StoredCredential;
};

export async function createPasskey(walletData: { 
  ordPk: string; 
  payPk: string; 
  name: string;
}) {
  try {
    // Generate a random username/id for the credential
    const userId = crypto.randomUUID();
    
    // Create PublicKeyCredentialCreationOptions
    const createCredentialOptions: PublicKeyCredentialCreationOptions = {
      challenge: new Uint8Array(32),
      rp: {
        name: "Your App Name",
        id: window.location.hostname
      },
      user: {
        id: Uint8Array.from(userId, c => c.charCodeAt(0)),
        name: walletData.name,
        displayName: walletData.name
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" }
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        requireResidentKey: true,
        residentKey: "required",
        userVerification: "required",
      },
      timeout: 60000
    };

    const credential = await navigator.credentials.create({
      publicKey: createCredentialOptions
    }) as PublicKeyCredential;

    if (!credential) throw new Error("Failed to create credential");

    // Get existing credentials or initialize empty object
    const existingCredentials = JSON.parse(localStorage.getItem('walletCredentials') || '{}') as StoredCredentials;

    // Store the new credential
    const storedCredential: StoredCredential = {
      id: credential.id,
      publicKey: Buffer.from(
        (credential.response as AuthenticatorAttestationResponse)
          .getPublicKey() as ArrayBuffer
      ).toString('base64'),
      walletData: {
        ...walletData,
        createdAt: Date.now()
      }
    };

    // Add to stored credentials
    existingCredentials[credential.id] = storedCredential;
    localStorage.setItem('walletCredentials', JSON.stringify(existingCredentials));

    return credential.id;
  } catch (error) {
    console.error('Error creating passkey:', error);
    throw error;
  }
}

export async function getPasskeys(): Promise<Array<{ id: string; name: string; createdAt: number }>> {
  try {
    const storedCredentials = localStorage.getItem('walletCredentials');
    if (!storedCredentials) return [];

    const credentials = JSON.parse(storedCredentials) as StoredCredentials;
    return Object.values(credentials).map(cred => ({
      id: cred.id,
      name: cred.walletData.name,
      createdAt: cred.walletData.createdAt
    }));
  } catch (error) {
    console.error('Error getting passkeys:', error);
    throw error;
  }
}

export async function getPasskey(credentialId?: string) {
  try {
    const storedCredentials = localStorage.getItem('walletCredentials');
    if (!storedCredentials) throw new Error("No stored credentials found");

    const credentials = JSON.parse(storedCredentials) as StoredCredentials;

    // If no specific credential ID is provided, get all available credentials
    const allowCredentials = credentialId 
      ? [{ 
          id: Uint8Array.from(atob(padBase64(credentials[credentialId].id)), c => c.charCodeAt(0)),
          type: 'public-key' as const
        }]
      : Object.values(credentials).map(cred => ({
          id: Uint8Array.from(atob(padBase64(cred.id)), c => c.charCodeAt(0)),
          type: 'public-key' as const
        }));

    const assertionOptions: PublicKeyCredentialRequestOptions = {
      challenge: new Uint8Array(32),
      allowCredentials,
      userVerification: "required",
      timeout: 60000,
      rpId: window.location.hostname
    };

    const assertion = await navigator.credentials.get({
      publicKey: assertionOptions
    }) as PublicKeyCredential;

    if (!assertion) throw new Error("Failed to get credential");

    // Return the wallet data for the selected credential
    const selectedCredential = credentials[assertion.id];
    if (!selectedCredential) throw new Error("Selected credential not found");

    return selectedCredential.walletData;
  } catch (error) {
    console.error('Error getting passkey:', error);
    throw error;
  }
}

// Helper function to pad base64 string
function padBase64(base64: string): string {
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  return padded.replace(/-/g, '+').replace(/_/g, '/');
}

export function removePasskey(credentialId: string): boolean {
  try {
    const storedCredentials = localStorage.getItem('walletCredentials');
    if (!storedCredentials) return false;

    const credentials = JSON.parse(storedCredentials) as StoredCredentials;
    if (!credentials[credentialId]) return false;

    delete credentials[credentialId];
    localStorage.setItem('walletCredentials', JSON.stringify(credentials));
    return true;
  } catch (error) {
    console.error('Error removing passkey:', error);
    return false;
  }
}

export function isPasskeyAvailable(): boolean {
  return window && 
         'PublicKeyCredential' in window && 
         'navigator' in window && 
         'credentials' in window.navigator;
} 