import forge from 'node-forge';
import fs from 'fs';

console.log("Generating keys...");

// Generate keypair
const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();

cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(
  cert.validity.notBefore.getFullYear() + 1
);

const attrs = [{ name: 'commonName', value: 'My Custom E-Sign App' }];
cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.sign(keys.privateKey);

// 🔴 IMPORTANT FIX IS HERE
const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
  keys.privateKey,
  cert,
  'password',
  {
    algorithm: '3des',
    friendlyName: 'signing-cert',
    generateLocalKeyId: true,
    macAlgorithm: 'sha1',   // <-- REQUIRED
    iterationCount: 2048    // <-- REQUIRED
  }
);

const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
fs.writeFileSync('certificate.p12', Buffer.from(p12Der, 'binary'));

console.log("✅ PKCS#12 with MAC created successfully");