# ✍️ eSign App

A lightweight, self-hosted **electronic signature solution** built with Node.js. Upload any PDF, place signatures and text annotations anywhere on the document, and receive a cryptographically **digitally signed PDF** — complete with an automated **audit trail page**.

---

## ✨ Features

- 📄 **PDF Upload & Preview** — Upload any PDF and view it directly in the browser
- ✍️ **Signature Canvas** — Draw your signature with a smooth, touch-friendly canvas
- 🖱️ **Drag & Drop Fields** — Place signature and text fields anywhere on any page
- 🔐 **Digital Signature (PKCS#12)** — Each signed PDF is cryptographically signed using an RSA-2048 / SHA-256 certificate
- 📋 **Audit Trail Page** — Automatically appended page recording signer name, email, IP address, timestamp, envelope ID, and signature specimen
- 🆔 **Unique Signature IDs** — Every signature block is stamped with a unique UUID for chain-of-custody traceability
- 📥 **Instant Download** — Signed PDF is returned immediately as a file download

---

## 🏗️ Architecture

```
esign-app/
├── public/
│   └── index.html       # Frontend SPA (vanilla HTML/CSS/JS)
├── uploads/             # Temp storage for incoming PDFs (auto-cleaned)
├── server.mjs           # Express backend — signing logic
├── create-cert.mjs      # One-time PKCS#12 certificate generator
├── certificate.p12      # Signing certificate (generated)
├── package.json
└── README.md
```

**Frontend** is a single-page app (vanilla JS + Canvas API) that handles:
- PDF rendering via browser's native viewer
- Signature drawing with `<canvas>`
- Field placement and coordinate tracking

**Backend** (`server.mjs`) handles:
- PDF ingestion via `multer`
- Visual annotation rendering with `pdf-lib`
- Certificate generation at startup (`node-forge`)
- Cryptographic signing with `@signpdf/signpdf` + `@signpdf/signer-p12`

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Web Framework | Express.js |
| PDF Manipulation | `pdf-lib` |
| Cryptography | `node-forge` |
| Digital Signing | `@signpdf/signpdf`, `@signpdf/signer-p12` |
| File Upload | `multer` |
| Frontend | Vanilla HTML / CSS / JavaScript |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **npm**

### Installation

```bash
git clone https://github.com/Frankie7878/esign-app.git
cd esign-app
npm install
```

### Run the Server

```bash
npm start
```

The app will be available at **http://localhost:3000**

---

## 📖 Usage

1. Open **http://localhost:3000** in your browser
2. Enter the **Signer Name**, **Email**, and **Envelope ID**
3. Upload a PDF document
4. Draw your **signature** on the canvas
5. Drag and drop **signature / text fields** onto the document pages
6. Click **Sign & Download**
7. Receive a fully signed PDF with an audit trail page

---

## 🔐 How the Digital Signature Works

On startup, the server automatically generates a **self-signed RSA-2048 certificate** valid for 1 year, stored as a PKCS#12 bundle in memory. This certificate is used to:

1. Apply a **PDF signature placeholder** (`plainAddPlaceholder`)
2. Sign the PDF bytes using the P12 signer (`@signpdf/signer-p12`)
3. Produce a PDF with an embedded, verifiable **digital signature field**

> **Note:** The included certificate is self-signed and suitable for internal / workflow use. For legally binding signatures in regulated environments, replace with a certificate issued by a trusted Certificate Authority (CA).

### Optionally Generate a Persistent Certificate

```bash
node create-cert.mjs
```

This writes `certificate.p12` to disk. You can modify `server.mjs` to load this file instead of generating one at runtime.

---

## 🔒 Security Considerations

- All uploaded PDFs are stored in the `uploads/` temp directory and **deleted immediately** after processing
- CORS is currently set to `*` — restrict this in production to your specific frontend domain
- The P12 passphrase (`'password'`) is hardcoded for simplicity — externalize via environment variable for production use

---

## 🗺️ Roadmap

- [ ] Email delivery of signed PDFs
- [ ] Multi-signer workflow support
- [ ] Cloud storage integration (S3 / Cloudflare R2)
- [ ] Production CA certificate support
- [ ] Authentication layer (JWT / session)

---

## 📄 License

MIT © Frank Zhang
