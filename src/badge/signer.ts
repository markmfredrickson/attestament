/**
 * Ed25519 badge signing and verification.
 *
 * Uses Node's built-in crypto module. Ed25519 signs raw bytes (no pre-hash),
 * matching the spec's `openssl pkeyutl -verify -rawin` verification.
 */

import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

export type KeyPair = {
  privateKey: KeyObject;
  publicKey: KeyObject;
};

export function generateKeypair(): KeyPair {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { privateKey, publicKey };
}

export function signPayload(payload: Buffer, privateKey: KeyObject): string {
  const sig = sign(null, payload, privateKey);
  return sig
    .toString("base64url")
    .replace(/=+$/, "");
}

export function verifySignature(
  payload: Buffer,
  signatureB64url: string,
  publicKey: KeyObject,
): boolean {
  try {
    const padded = signatureB64url + "=".repeat((4 - (signatureB64url.length % 4)) % 4);
    const sig = Buffer.from(padded, "base64url");
    return verify(null, payload, publicKey, sig);
  } catch {
    return false;
  }
}

export function savePrivateKey(key: KeyObject, path: string): void {
  writeFileSync(
    path,
    key.export({ type: "pkcs8", format: "pem" }),
  );
}

export function savePublicKey(key: KeyObject, path: string): void {
  writeFileSync(
    path,
    key.export({ type: "spki", format: "pem" }),
  );
}

export function loadPrivateKey(path: string): KeyObject {
  return createPrivateKey(readFileSync(path));
}

export function loadPublicKey(path: string): KeyObject {
  return createPublicKey(readFileSync(path));
}
