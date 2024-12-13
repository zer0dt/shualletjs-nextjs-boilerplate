
  interface Window {
    newPK?: () => string;
    restoreWallet?: (ownerPK: string, paymentPk: string, isNew?: boolean) => void;
    backupWallet?: () => void;
    sendBSV?: () => void;
    getWalletBalance?: (address?: string) => Promise<number>;
    getCachedUTXOs: () => any[];
    logout?: () => void;
    bsv?: any;
    setupWallet?: () => Promise<void>;
    localStorage: {
      walletAddress: string;
      walletKey: string;
      ownerKey: string;
      ownerAddress: string;
      ownerPublicKey: string;
    } & Storage;
  }

