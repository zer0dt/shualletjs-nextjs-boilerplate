import { bsv } from 'scrypt-ts';

const B_PROTOCOL_ADDRESS = '19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut';
const MAP_PROTOCOL_ADDRESS = '1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5';
const AIP_PROTOCOL_ADDRESS = '15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva';
const BAP_PROTOCOL_ADDRESS = '1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT';
const BPP_PROTOCOL_ADDRESS = 'BPP';
const P2PKH_SIGSCRIPT_SIZE = 1 + 73 + 1 + 33;
const P2PKH_OUTPUT_SIZE = 8 + 1 + 1 + 1 + 1 + 20 + 1 + 1;
const P2PKH_INPUT_SIZE = 36 + 1 + P2PKH_SIGSCRIPT_SIZE + 4;
const PUB_KEY_SIZE = 66;
const FEE_PER_KB = 3;
const FEE_FACTOR = (FEE_PER_KB / 1000); // 1 satoshi per Kilobyte
const SIGHASH_ALL_FORKID = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID;
const SIGHASH_SINGLE_ANYONECANPAY_FORKID = bsv.crypto.Signature.SIGHASH_SINGLE | bsv.crypto.Signature.SIGHASH_ANYONECANPAY | bsv.crypto.Signature.SIGHASH_FORKID;
const SIGHASH_ALL_ANYONECANPAY_FORKID = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_ANYONECANPAY | bsv.crypto.Signature.SIGHASH_FORKID;

export const getBSVPublicKey = (pk: string) => { return bsv.PublicKey.fromPrivateKey(bsv.PrivateKey.fromWIF(pk)) }

export const newPK = () => {
    const pk = new bsv.PrivateKey();
    const pkWIF = pk.toWIF();
    return pkWIF;
} 
export const sendBSV = async(satoshis: number, toAddress: string) => {
    try {
        if (!satoshis) { throw `Invalid amount` }
        const balance = await getWalletBalance();
        if (balance < satoshis) throw `Amount entered exceeds balance`;
        const sendMax = balance === satoshis;
        if (!toAddress) { throw `Invalid address` }
        
        const addr = bsv.Address.fromString(toAddress);
        if (addr) {
            const bsvtx = new bsv.Transaction();
            if (sendMax) {
                bsvtx.to(addr, satoshis - 2);
            } else {
                bsvtx.to(addr, satoshis);
            }
            const rawtx = await payForRawTx(bsvtx.toString());
            if (rawtx) {
                const t = await broadcast(rawtx, true, localStorage.walletAddress);
                return t; // Return txid instead of alerting
            } 
        }
    } catch(e) {
        console.log(e);
        throw e; // Throw error instead of alerting
    }
}


export const broadcast = async (txhex: string, cacheUTXOs = false, address = null) => {
    console.log(cacheUTXOs, address)
    try {
        const response = await fetch('/api/broadcast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ txhex })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Broadcast error:', error);
            throw new Error(`Broadcast failed: ${error.error}`);
        }

        const { txid } = await response.json();
        console.log('Transaction broadcasted successfully:', txid);

        return txid;
    } catch (error) {
        console.error('Failed to broadcast:', error);
        throw error;
    }
}

const btUTXOs = async (address: string) => {
    const utxos = []
    if (!utxos.length) {
        console.log(`Calling Bitails UTXOs endpoint...`);
        const r = await fetch(`https://api.bitails.io/address/${address}/unspent`);
        const { unspent } = await r.json();
        return normalizeUTXOs(unspent);
    } else { return utxos }
} 

export const getPaymentUTXOs = async(address: string, amount: number) => {
    const utxos = await btUTXOs(address);
    const addr = bsv.Address.fromString(address);
    const script = bsv.Script.fromAddress(addr);
    let cache = [], satoshis = 0;
    for (let utxo of utxos) {
        if (utxo.satoshis > 1) {
            const foundUtxo = utxos.find(utxo => utxo.satoshis >= amount + 2);
            if (foundUtxo) {
                return [{ satoshis: foundUtxo.satoshis, vout: foundUtxo.vout, txid: foundUtxo.txid, script: script.toHex() }]
            }
            cache.push(utxo);
            if (amount) {
                satoshis = cache.reduce((a, curr) => { return a + curr.satoshis }, 0);
                if (satoshis >= amount) {
                    return cache.map(utxo => {
                        return { satoshis: utxo.satoshis, vout: utxo.vout, txid: utxo.txid, script: script.toHex() }
                    });
                }
            } else {
                return utxos.map(utxo => {
                    return { satoshis: utxo.satoshis, vout: utxo.vout, txid: utxo.txid, script: script.toHex() }
                });
            }
        }
    }
    return [];
}

export const payForRawTx = async (rawtx: string) => {
    const bsvtx = new bsv.Transaction(rawtx);
    const satoshis = bsvtx.outputs.reduce(((t, e) => t + e.satoshis), 0);
    const txFee = parseInt(((bsvtx._estimateSize() + (P2PKH_INPUT_SIZE * bsvtx.inputs.length)) * FEE_FACTOR)) + 1;
    const utxos = await getPaymentUTXOs(localStorage.walletAddress, satoshis + txFee);
    if (!utxos.length) { throw `Insufficient funds` }
    bsvtx.from(utxos);
    const inputSatoshis = utxos.reduce(((t, e) => t + e.satoshis), 0);
    if (inputSatoshis - satoshis - txFee > 0) {
        bsvtx.to(localStorage.walletAddress, inputSatoshis - satoshis - txFee);
    }
    bsvtx.sign(bsv.PrivateKey.fromWIF(localStorage.walletKey));
    console.log(bsvtx.toString())
    return bsvtx.toString();
}

export const getWalletBalance = async(address = localStorage.walletAddress): Promise<number> => {
    const utxos = await btUTXOs(address);

    const balance = utxos.reduce(((t, e) => t + e.satoshis), 0)
    return balance; 
}

const normalizeUTXOs = (utxos: any[]): any[] => {
  return utxos.map((utxo) => {
      return {
          satoshis: utxo?.value || utxo?.satoshis,
          txid: utxo?.txid || utxo.tx_hash,
          vout: utxo.vout === undefined ? utxo.tx_pos : utxo.vout
      }
  })
}

export const restoreWallet = (oPK: string, pPk: string) => {
  const pk = bsv.PrivateKey.fromWIF(pPk);
  const pkWif = pk.toString();
  const address = bsv.Address.fromPrivateKey(pk)
  const ownerPk = bsv.PrivateKey.fromWIF(oPK);
  localStorage.ownerKey = ownerPk.toWIF();
  const ownerAddress = bsv.Address.fromPrivateKey(ownerPk);
  localStorage.ownerAddress = ownerAddress.toString();
  localStorage.walletAddress = address.toString();
  localStorage.walletKey = pkWif;
  localStorage.ownerPublicKey = ownerPk.toPublicKey().toHex();
}

interface BSocialPost {
    appName: string;
    type: string;
    txId: string;
    texts: Array<{ text: string; type: string }>;
    images: Array<{ content: string; type: string }>;
    extraMapData: Record<string, string>;
    setType(type: string): void;
    setTxId(txId: string): void;
    addMapData(key: string, value: string): void;
    addText(text: string, type?: string): void;
    addMarkdown(markdown: string): void;
    addImage(dataUrl: string): void;
    getOps(format?: string): string[];
}

interface BSocialLike {
    appName: string;
    txId: string;
    emoji: string;
    setTxId(txId: string): void;
    setEmoji(emoji: string): void;
    getOps(format?: string): string[];
}

interface BSocialTip {
    appName: string;
    txId: string;
    amount: number;
    currency: string;
    setTxId(txId: string): void;
    setAmount(amount: number, currency: string): void;
    getOps(format?: string): string[];
}

interface BSocialFollow {
    appName: string;
    idKey: string;
    followAction: string;
    setIdKey(idKey: string): void;
    setAction(action: string): void;
    getOps(format?: string): string[];
}

class BSocialPost implements BSocialPost {
    appName: string;
    type: string;
    txId: string;
    texts: Array<{ text: string; type: string }>;
    images: Array<{ content: string; type: string }>;
    extraMapData: Record<string, string>;

    constructor(appName: string) {
        if (!appName) throw new Error('App name needs to be set');
        this.appName = appName;
        this.type = 'post';
        this.txId = '';
        this.texts = [];
        this.images = [];
        this.extraMapData = {};
    }

    setType(type: string): void {
        this.type = type;
    }

    setTxId(txId: string): void {
        this.txId = txId;
    }

    addMapData(key: string, value: string): void {
        if (typeof key !== 'string' || typeof value !== 'string') {
            throw new Error('Key and value should be a string');
        }
        this.extraMapData[key] = value;
    }

    addText(text: string, type: string = 'text/markdown'): void {
        if (typeof text !== 'string') throw new Error('Text should be a string');
        this.texts.push({ text, type });
    }

    addMarkdown(markdown: string): void {
        this.addText(markdown);
    }

    addImage(dataUrl: string): void {
        const image = dataUrl.split(',');
        const meta = image[0].split(';');
        const type = meta[0].split(':');

        if (type[0] !== 'data' || meta[1] !== 'base64' || !type[1].match('image/')) {
            throw new Error('Invalid image dataUrl format');
        }

        const img = atob(image[1]);
        this.images.push({
            content: img,
            type: type[1],
        });
    }

    getOps(format: string = 'hex'): string[] {
        const hasContent = this.texts.length > 0 || this.images.length > 0;
        const isRepost = this.type === 'repost' && this.txId;
        if (!hasContent && !isRepost) {
            throw new Error('There is no content for this post');
        }

        const ops: string[] = [];

        if (this.texts.length > 0) {
            this.texts.forEach((t) => {
                ops.push(B_PROTOCOL_ADDRESS);
                ops.push(t.text);
                ops.push(t.type);
                ops.push('UTF-8');
                ops.push('|');
            });
        }

        if (this.images.length > 0) {
            this.images.forEach((image) => {
                ops.push(B_PROTOCOL_ADDRESS);
                ops.push(image.content);
                ops.push(image.type);
                ops.push('|');
            });
        }

        ops.push(MAP_PROTOCOL_ADDRESS);
        ops.push('SET');
        ops.push('app');
        ops.push(this.appName);
        ops.push('type');
        ops.push(this.type);

        if (this.txId) {
            if (this.type !== 'repost') {
                ops.push('context');
                ops.push('tx');
            }
            ops.push('tx');
            ops.push(this.txId);
        }

        const extraMapData = Object.keys(this.extraMapData);
        if (extraMapData.length) {
            extraMapData.forEach((key) => {
                ops.push(key);
                ops.push(this.extraMapData[key]);
            });
        }

        return ops.map(op => op.toString(format));
    }
}

class BSocialLike {
    constructor(appName: string) {
      if (!appName) throw new Error('App name needs to be set');
      this.appName = appName;
      this.txId = '';
      this.emoji = '';
    }
  
    setTxId(txId: string) {
      this.txId = txId;
    }
  
    setEmoji(emoji: string) {
      if (typeof emoji !== 'string' || !emoji.match(/\p{Emoji}/gu)) {
        throw new Error('Invalid emoji');
      }
      this.emoji = emoji;
    }
  
    getOps(format = 'hex') {
      if (!this.txId) throw new Error('Like is not referencing a valid transaction');
  
      const ops = [];
      ops.push(MAP_PROTOCOL_ADDRESS); // MAP
      ops.push('SET');
      ops.push('app');
      ops.push(this.appName);
      ops.push('type');
      ops.push('like');
      ops.push('context');
      ops.push('tx');
      ops.push('tx');
      ops.push(this.txId);
  
      if (this.emoji) {
        ops.push('emoji');
        ops.push(this.emoji);
      }
  
      return ops.map((op) => {
        return Buffer.from(op).toString(format);
      });
    }
  }
  

class BSocialTip implements BSocialTip {
    appName: string;
    txId: string;
    amount: number;
    currency: string;

    constructor(appName: string) {
        if (!appName) throw new Error('App name needs to be set');
        this.appName = appName;
        this.txId = '';
        this.amount = 0;
        this.currency = '';
    }

    setTxId(txId: string): void {
        this.txId = txId;
    }

    setAmount(amount: number, currency: string): void {
        this.amount = amount;
        this.currency = currency;
    }

    getOps(format: string = 'hex'): string[] {
        if (!this.txId) throw new Error('Tip is not referencing a valid transaction');

        const ops: string[] = [];
        ops.push(MAP_PROTOCOL_ADDRESS); // MAP
        ops.push('SET');
        ops.push('app');
        ops.push(this.appName);
        ops.push('type');
        ops.push('tip');
        ops.push('context');
        ops.push('tx');
        ops.push('tx');
        ops.push(this.txId);

        if (this.amount && this.currency) {
            ops.push('amount');
            ops.push(this.amount.toString());
            ops.push('currency');
            ops.push(this.currency);
        }

        return ops.map(op => op.toString(format));
    }
}

class BSocialFollow implements BSocialFollow {
    appName: string;
    idKey: string;
    followAction: string;

    constructor(appName: string) {
        if (!appName) throw new Error('App name needs to be set');
        this.appName = appName;
        this.idKey = '';
        this.followAction = 'follow';
    }

    setIdKey(idKey: string): void {
        this.idKey = idKey;
    }

    setAction(action: string): void {
        if (action !== 'follow' && action !== 'unfollow') throw new Error('Invalid action');
        this.followAction = action;
    }

    getOps(format: string = 'hex'): string[] {
        if (!this.idKey) throw new Error('Follow is not referencing a valid id');

        const ops: string[] = [];
        ops.push(MAP_PROTOCOL_ADDRESS);
        ops.push('SET');
        ops.push('app');
        ops.push(this.appName);
        ops.push('type');
        ops.push(this.followAction);
        ops.push('idKey');
        ops.push(this.idKey);

        return ops.map(op => Buffer.from(op).toString(format));
    }
}

export class BSocial {
    private appName: string;

    constructor(appName: string) {
        if (!appName) throw new Error('App name needs to be set');
        this.appName = appName;
    }

    post(): BSocialPost {
        return new BSocialPost(this.appName);
    }

    repost(txId: string): BSocialPost {
        const post = new BSocialPost(this.appName);
        post.setType('repost');
        post.setTxId(txId);
        return post;
    }

    reply(txId: string): BSocialPost {
        const post = new BSocialPost(this.appName);
        post.setTxId(txId);
        return post;
    }

    like(txId: string, emoji = ''): BSocialLike {
        const like = new BSocialLike(this.appName);
        like.setTxId(txId);
        if (emoji) {
            like.setEmoji(emoji);
        }
        return like;
    }

    tip(txId: string, amount: number = 0, currency: string = 'USD'): BSocialTip {
        const tip = new BSocialTip(this.appName);
        tip.setTxId(txId);
        if (amount && currency) {
            tip.setAmount(amount, currency);
        }
        return tip;
    }

    follow(idKey: string): BSocialFollow {
        const follow = new BSocialFollow(this.appName);
        follow.setIdKey(idKey);
        return follow;
    }

    unfollow(idKey: string): BSocialFollow {
        const follow = new BSocialFollow(this.appName);
        follow.setIdKey(idKey);
        follow.setAction('unfollow');
        return follow;
    }
}

export function signPayload(data: any, pkWIF: string, isLike = false) {
    const arrops = data.getOps('utf8');
    let hexarrops = [];
    hexarrops.push('6a');
    if (isLike) { hexarrops.push('6a') }
    arrops.forEach(o => { hexarrops.push(str2Hex(o)) })
    if (isLike) { hexarrops.push('7c') }
    let hexarr = [], payload = [];
    if (pkWIF) {
        const b2sign = hexArrayToBSVBuf(hexarrops);
        const privateKey = new bsv.PrivateKey.fromWIF(pkWIF);
        const signature = bsv.Message.sign(b2sign.toString(), privateKey);
        const address = privateKey.toAddress().toString();
        payload = arrops.concat(['|', AIP_PROTOCOL_ADDRESS, 'BITCOIN_ECDSA', address, signature]);
    } else { 
        payload = arrops 
    }
    payload.forEach(p => { hexarr.push(str2Hex(p)) })
    return payload;
}

const hex2Str = (hex: string) => {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        let v = parseInt(hex.substr(i, 2), 16);
        if (v) str += String.fromCharCode(v);
    }
    return str; 
}

const str2Hex = (str: string) => {
    const hex = unescape(encodeURIComponent(str)).split('').map(v => {return v.charCodeAt(0).toString(16).padStart(2,'0')}).join('');
    return hex;
}

const hexArrayToBSVBuf = (arr: string) => {
    const hexBuf = arrToBuf(arr);
    const decoded = new TextDecoder().decode(hexBuf);
    const str2sign = hex2Str(decoded);
    const abuf = strToArrayBuffer(str2sign);
    const bsvBuf = dataToBuf(abuf);
    return bsvBuf;
}

const arrToBuf = (arr: string) => {
    const msgUint8 = new TextEncoder().encode(arr);
    const decoded = new TextDecoder().decode(msgUint8);
    const value = decoded.replaceAll(',', '');
    return new TextEncoder().encode(value);
}

const strToArrayBuffer = (binary_string: string) => {
    const bytes = new Uint8Array( binary_string.length );
    for (let i = 0; i < binary_string.length; i++)  {bytes[i] = binary_string.charCodeAt(i) }
    return bytes;
}

const dataToBuf = (arr: string) => {
    const bufferWriter = new bsv.encoding.BufferWriter();
    arr.forEach(a => { bufferWriter.writeUInt8(a) });
    return bufferWriter.toBuffer();
}

