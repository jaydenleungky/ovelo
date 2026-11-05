// The phone's JavaScript engine has no Web Crypto, so Supabase would make
// sign-in codes with Math.random and skip hashing them. Fill in the two
// parts it uses from expo-crypto. Browsers already have these (see .web.ts).
import * as Crypto from 'expo-crypto';

type DigestData = Parameters<typeof Crypto.digest>[1];

const subtle = {
  digest(algorithm: string, data: DigestData) {
    if (algorithm !== Crypto.CryptoDigestAlgorithm.SHA256) {
      throw new Error(`Unsupported digest: ${algorithm}`);
    }
    return Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data);
  },
};

const globals = globalThis as unknown as { crypto?: Record<string, unknown> };
globals.crypto = {
  ...globals.crypto,
  getRandomValues: Crypto.getRandomValues,
  subtle,
};
