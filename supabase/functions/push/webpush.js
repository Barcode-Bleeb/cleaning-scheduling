// Minimal Web Push sender: VAPID (RFC 8292) + aes128gcm payload encryption
// (RFC 8291 / RFC 8188), implemented with WebCrypto only — no dependencies.
// Runs identically on Supabase Edge (Deno) and Node >= 20 (used by the tests).

const te = new TextEncoder();

export function b64url(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function b64urlDecode(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concat(...bufs) {
  const total = bufs.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const b of bufs) { out.set(b, off); off += b.length; }
  return out;
}
async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, len * 8);
  return new Uint8Array(bits);
}

/* ---------------- VAPID keys ---------------- */
export async function generateVapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const privJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicKey: b64url(pubRaw), privateJwk: privJwk };
}

/* ---------------- VAPID authorization header ---------------- */
export async function vapidAuthHeader(endpoint, subject, publicKeyB64, privateJwk) {
  const aud = new URL(endpoint).origin;
  const header = b64url(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(te.encode(JSON.stringify({
    aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject,
  })));
  const signingInput = te.encode(header + "." + claims);
  const key = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, signingInput));
  const jwt = header + "." + claims + "." + b64url(sig);
  return `vapid t=${jwt}, k=${publicKeyB64}`;
}

/* ---------------- aes128gcm payload encryption (RFC 8291) ---------------- */
// p256dh / auth come from the browser's PushSubscription (base64url strings).
// Returns the complete HTTP body: header block + ciphertext.
export async function encryptPayload(plaintext, p256dh, auth, testKeys) {
  const uaPubRaw = b64urlDecode(p256dh);
  const authSecret = b64urlDecode(auth);

  const asPair = testKeys?.asPair || await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", asPair.publicKey));
  const uaPubKey = await crypto.subtle.importKey("raw", uaPubRaw, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaPubKey }, asPair.privateKey, 256));

  // IKM = HKDF(salt=auth_secret, ikm=ecdh_secret, info="WebPush: info" || 0x00 || ua_public || as_public, 32)
  const ikm = await hkdf(authSecret, ecdhSecret, concat(te.encode("WebPush: info\0"), uaPubRaw, asPubRaw), 32);

  const salt = testKeys?.salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);

  // single record: plaintext || 0x02 (last-record delimiter, RFC 8188)
  const record = concat(typeof plaintext === "string" ? te.encode(plaintext) : plaintext, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, record));

  // header block: salt(16) | rs(4) | idlen(1) | keyid(as_public, 65)
  const headerBlock = new Uint8Array(16 + 4 + 1 + 65);
  headerBlock.set(salt, 0);
  new DataView(headerBlock.buffer).setUint32(16, 4096);
  headerBlock[20] = 65;
  headerBlock.set(asPubRaw, 21);
  return concat(headerBlock, ciphertext);
}

/* ---------------- receiver-side decrypt (used by the test suite only) ---------------- */
export async function decryptPayload(body, uaPrivateJwk, auth) {
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPubRaw = body.slice(21, 21 + idlen);
  const ciphertext = body.slice(21 + idlen);
  const authSecret = b64urlDecode(auth);

  const uaPriv = await crypto.subtle.importKey("jwk", uaPrivateJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const uaPubJwk = { ...uaPrivateJwk }; delete uaPubJwk.d; uaPubJwk.key_ops = [];
  const uaPubKey = await crypto.subtle.importKey("jwk", uaPubJwk, { name: "ECDH", namedCurve: "P-256" }, true, []);
  const uaPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", uaPubKey));
  const asPubKey = await crypto.subtle.importKey("raw", asPubRaw, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asPubKey }, uaPriv, 256));

  const ikm = await hkdf(authSecret, ecdhSecret, concat(te.encode("WebPush: info\0"), uaPubRaw, asPubRaw), 32);
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const record = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aesKey, ciphertext));
  let end = record.length - 1;
  while (end >= 0 && record[end] === 0) end--; // strip padding
  if (record[end] !== 2) throw new Error("bad record delimiter");
  return new TextDecoder().decode(record.slice(0, end));
}

/* ---------------- send one push ---------------- */
// sub: { endpoint, keys: { p256dh, auth } } — the browser's PushSubscription JSON.
// Returns the HTTP status from the push service (201 = accepted, 404/410 = gone).
export async function sendPush(sub, payload, vapid, subject = "mailto:sparkle@example.com") {
  const body = await encryptPayload(JSON.stringify(payload), sub.keys.p256dh, sub.keys.auth);
  const authHeader = await vapidAuthHeader(sub.endpoint, subject, vapid.publicKey, vapid.privateJwk);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
      "Urgency": "normal",
    },
    body,
  });
  return res.status;
}
