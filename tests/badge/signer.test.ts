import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  generateKeypair,
  loadPrivateKey,
  loadPublicKey,
  savePrivateKey,
  savePublicKey,
  signPayload,
  verifySignature,
} from "../../src/badge/signer.js";

const PAYLOAD = Buffer.from('{"branch":"main","repo":"owner/repo"}');

describe("signer", () => {
  it("sign/verify roundtrip", () => {
    const { privateKey, publicKey } = generateKeypair();
    const sig = signPayload(PAYLOAD, privateKey);
    expect(verifySignature(PAYLOAD, sig, publicKey)).toBe(true);
  });

  it("wrong key fails verification", () => {
    const kp1 = generateKeypair();
    const kp2 = generateKeypair();
    const sig = signPayload(PAYLOAD, kp1.privateKey);
    expect(verifySignature(PAYLOAD, sig, kp2.publicKey)).toBe(false);
  });

  it("tampered payload fails verification", () => {
    const { privateKey, publicKey } = generateKeypair();
    const sig = signPayload(PAYLOAD, privateKey);
    const tampered = Buffer.concat([PAYLOAD, Buffer.from("x")]);
    expect(verifySignature(tampered, sig, publicKey)).toBe(false);
  });

  it("signature is base64url (no +, /, =)", () => {
    const { privateKey } = generateKeypair();
    const sig = signPayload(PAYLOAD, privateKey);
    expect(sig).not.toMatch(/[+/=]/);
  });

  it("signature is deterministic", () => {
    const { privateKey } = generateKeypair();
    const sig1 = signPayload(PAYLOAD, privateKey);
    const sig2 = signPayload(PAYLOAD, privateKey);
    expect(sig1).toBe(sig2);
  });

  it("save/load keypair roundtrip", () => {
    const dir = mkdtempSync(join(tmpdir(), "attestament-"));
    const { privateKey, publicKey } = generateKeypair();

    savePrivateKey(privateKey, join(dir, "key.pem"));
    savePublicKey(publicKey, join(dir, "pub.pem"));

    const loadedPrivate = loadPrivateKey(join(dir, "key.pem"));
    const loadedPublic = loadPublicKey(join(dir, "pub.pem"));

    const sig = signPayload(PAYLOAD, loadedPrivate);
    expect(verifySignature(PAYLOAD, sig, loadedPublic)).toBe(true);
  });
});
