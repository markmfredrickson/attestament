import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateKeypair, savePublicKey, signPayload } from "../src/badge/signer.js";
import { main } from "../src/cli.js";

describe("cli", () => {
  it("keygen creates key files", async () => {
    const dir = mkdtempSync(join(tmpdir(), "attestament-cli-"));
    const rc = await main(["keygen", "--out", join(dir, "test.key"), "--pubkey", join(dir, "test.pub")]);
    expect(rc).toBe(0);
    expect(readFileSync(join(dir, "test.key"), "utf-8")).toContain("PRIVATE KEY");
    expect(readFileSync(join(dir, "test.pub"), "utf-8")).toContain("PUBLIC KEY");
  });

  it("verify valid signature", async () => {
    const dir = mkdtempSync(join(tmpdir(), "attestament-cli-"));
    const { privateKey, publicKey } = generateKeypair();
    const payload = Buffer.from('{"test":"data"}');
    const sig = signPayload(payload, privateKey);

    savePublicKey(publicKey, join(dir, "pub.pem"));
    writeFileSync(join(dir, "badge.json"), payload);
    writeFileSync(join(dir, "badge.sig"), sig);

    const rc = await main([
      "verify",
      "--payload", join(dir, "badge.json"),
      "--sig", join(dir, "badge.sig"),
      "--pubkey", join(dir, "pub.pem"),
    ]);
    expect(rc).toBe(0);
  });

  it("verify invalid signature", async () => {
    const dir = mkdtempSync(join(tmpdir(), "attestament-cli-"));
    const kp1 = generateKeypair();
    const kp2 = generateKeypair();
    const payload = Buffer.from('{"test":"data"}');
    const sig = signPayload(payload, kp1.privateKey);

    savePublicKey(kp2.publicKey, join(dir, "pub.pem"));
    writeFileSync(join(dir, "badge.json"), payload);
    writeFileSync(join(dir, "badge.sig"), sig);

    const rc = await main([
      "verify",
      "--payload", join(dir, "badge.json"),
      "--sig", join(dir, "badge.sig"),
      "--pubkey", join(dir, "pub.pem"),
    ]);
    expect(rc).toBe(1);
  });

  it("no command → error", async () => {
    const rc = await main([]);
    expect(rc).toBe(1);
  });
});
