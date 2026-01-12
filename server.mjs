import express from 'express';
import multer from 'multer';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import forge from 'node-forge';

// --- IMPORTS ---
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { plainAddPlaceholder } from '@signpdf/placeholder-plain';

const app = express();

// --- CORS & HEADERS ---
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  next();
});

// --- TIMEOUTS & LIMITS ---
const server = app.listen(3000, () => console.log('🚀 Server running at http://localhost:3000'));
server.keepAliveTimeout = 300000;
server.headersTimeout = 305000;

const upload = multer({ 
  dest: 'uploads/',
  limits: { fieldSize: 100 * 1024 * 1024, fileSize: 100 * 1024 * 1024 }
});

app.use(express.static('public'));

// --- CERTIFICATE GENERATION ---
let p12Buffer;
function generateIdentity() {
  console.log('🔐 Generating Identity...');
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [{ name: 'commonName', value: 'My E-Sign App User' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, 'password', {
    algorithm: '3des', friendlyName: 'signing-key', generateLocalKeyId: true, macAlgorithm: 'sha1', iterationCount: 2048,
  });
  p12Buffer = Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary');
  console.log('✅ Identity Ready.');
}
generateIdentity();

// ======================================================
// ✍️ SIGN ENDPOINT
// ======================================================
app.post('/sign-document', upload.single('pdf'), async (req, res) => {
  try {
    console.log("📥 Request received");

    if (!req.file) throw new Error('Missing PDF');
    if (!req.body.fields) throw new Error('Missing Fields');

    let fields;
    try { fields = JSON.parse(req.body.fields); } catch(e) { throw new Error("Invalid JSON"); }

    const { signerName, signerEmail, envelopeId } = req.body;
    const timestamp = new Date().toUTCString();
    
    // IP LOGIC
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
    if (ip.includes('::ffff:')) ip = ip.split('::ffff:')[1];

    // 1. FRESH COPY TECHNIQUE
    const originalPdfBytes = fs.readFileSync(req.file.path);
    const originalDoc = await PDFDocument.load(originalPdfBytes);
    const pdfDoc = await PDFDocument.create();
    const copiedPages = await pdfDoc.copyPages(originalDoc, originalDoc.getPageIndices());
    copiedPages.forEach(page => pdfDoc.addPage(page));

    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Track specimen for audit
    let signatureSpecimen = null;
    let signatureUUID = null;

    // 2. DRAW VISUALS
    for (const field of fields) {
        if (field.pageIndex >= pages.length) continue;
        const page = pages[field.pageIndex];
        const { width, height } = page.getSize();
        
        // Base coordinates from frontend
        const x = width * parseFloat(field.xPercent);
        let y = height - (height * parseFloat(field.yPercent));

        if (field.type === 'image') {
            const pngImage = await pdfDoc.embedPng(field.value);
            
            // Capture for audit page
            if (!signatureSpecimen) {
                signatureSpecimen = pngImage;
                signatureUUID = field.uuid || Math.random().toString(36).substring(2, 12).toUpperCase();
            }
            
            // --- DRAW THE "eSigned" BLOCK (TIGHTER) ---
            const sigWidth = 120; // Reduced from 140 for cleaner look
            const sigHeight = (pngImage.height / pngImage.width) * sigWidth;
            
            // TIGHTER PADDING: Reduced extra space from 30 to 12
            const blockHeight = sigHeight + 12; 

            // Shift Y up to account for the block
            const drawY = y - blockHeight; 

            // 1. "eSigned by:" Text
            page.drawText('eSigned by:', {
                x: x + 5, 
                y: drawY + sigHeight + 4, // Adjusted Y to sit tight on top of image
                size: 9,
                font: fontBold,
                color: rgb(0.2, 0.2, 0.2)
            });

            // 2. The Signature Image
            page.drawImage(pngImage, { 
                x: x + 10, 
                y: drawY + 6, // Adjusted to sit between text and ID
                width: sigWidth, 
                height: sigHeight 
            });

            // 3. The ID Code
            const uniqueId = field.uuid || signatureUUID;
            page.drawText(uniqueId, {
                x: x + 5,
                y: drawY - 2, // Sits right at the bottom baseline
                size: 7, // Slightly smaller font for ID
                font: font,
                color: rgb(0.4, 0.4, 0.4)
            });

            // 4. The Blue Side Bracket (Tighter)
            const bracketColor = rgb(0, 0.35, 0.65);
            // Left Line
            page.drawLine({
                start: { x: x, y: drawY - 2 },
                end: { x: x, y: drawY + blockHeight },
                thickness: 2,
                color: bracketColor
            });
            // Top Notch
            page.drawLine({
                start: { x: x, y: drawY + blockHeight },
                end: { x: x + 8, y: drawY + blockHeight },
                thickness: 2,
                color: bracketColor
            });
            // Bottom Notch
            page.drawLine({
                start: { x: x, y: drawY - 2 },
                end: { x: x + 8, y: drawY - 2 },
                thickness: 2,
                color: bracketColor
            });

        } else if (field.type === 'text') {
            y = y - 14;
            page.drawText(field.value, { x, y, size: 14, font: font, color: rgb(0,0,0) });
        }
    }

    // 3. AUDIT TRAIL PAGE
    const audit = pdfDoc.addPage();
    let yPos = 750;
    
    const drawLine = (label, value) => {
        audit.drawText(`${label}:`, { x: 50, y: yPos, size: 12, font: fontBold });
        audit.drawText(value || 'N/A', { x: 180, y: yPos, size: 12, font: font });
        yPos -= 25;
    };

    audit.drawText('Certificate of Completion', { x: 50, y: 800, size: 24, font: fontBold });
    drawLine('Envelope ID', envelopeId);
    drawLine('Signer Name', signerName);
    drawLine('Signer Email', signerEmail);
    drawLine('IP Address', ip);
    drawLine('Timestamp', timestamp);
    
    // --- DISPLAY SIGNATURE ON AUDIT PAGE (MATCHING STYLE) ---
    if (signatureSpecimen) {
        yPos -= 40;
        audit.drawText('Signature Specimen:', { x: 50, y: yPos, size: 14, font: fontBold });
        yPos -= 10;
        
        const sigWidth = 120;
        const sigHeight = (signatureSpecimen.height / signatureSpecimen.width) * sigWidth;
        const blockHeight = sigHeight + 12;
        const startX = 50;
        const drawY = yPos - blockHeight;

        // Labels
        audit.drawText('eSigned by:', { x: startX + 5, y: drawY + sigHeight + 4, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        audit.drawImage(signatureSpecimen, { x: startX + 10, y: drawY + 6, width: sigWidth, height: sigHeight });
        audit.drawText(signatureUUID, { x: startX + 5, y: drawY - 2, size: 7, font: font, color: rgb(0.4, 0.4, 0.4) });
        
        // Brackets
        const bracketColor = rgb(0, 0.35, 0.65);
        audit.drawLine({ start: { x: startX, y: drawY - 2 }, end: { x: startX, y: drawY + blockHeight }, thickness: 2, color: bracketColor });
        audit.drawLine({ start: { x: startX, y: drawY + blockHeight }, end: { x: startX + 8, y: drawY + blockHeight }, thickness: 2, color: bracketColor });
        audit.drawLine({ start: { x: startX, y: drawY - 2 }, end: { x: startX + 8, y: drawY - 2 }, thickness: 2, color: bracketColor });
    }

    // 4. SAVE & SIGN
    const visualPdfBuffer = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));

    const placeholderResult = plainAddPlaceholder({
        pdfBuffer: visualPdfBuffer,
        reason: 'Digitally Signed',
        signatureLength: 16000,
    });
    const pdfToSign = Buffer.isBuffer(placeholderResult) ? placeholderResult : Buffer.from(placeholderResult.pdf);

    console.log("🔐 Signing...");
    const signer = new P12Signer(p12Buffer, { passphrase: 'password' });
    const signPdf = new SignPdf();
    const signedPdf = await signPdf.sign(pdfToSign, signer);

    console.log("✅ Signed! Sending " + signedPdf.length + " bytes.");

    res.status(200);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="signed_${envelopeId}.pdf"`,
    });
    res.end(signedPdf);

  } catch (err) {
    console.error('❌ Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (req.file && req.file.path) try { fs.unlinkSync(req.file.path); } catch(e){}
  }
});