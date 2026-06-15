import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import forge from 'node-forge';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { plainAddPlaceholder } from '@signpdf/placeholder-plain';

let p12Buffer;
function generateIdentity() {
  if (p12Buffer) return p12Buffer;
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
  return p12Buffer;
}

export async function onRequestPost(context) {
  try {
    const { request } = context;
    const formData = await request.formData();

    const pdfFile = formData.get('pdf');
    const fieldsStr = formData.get('fields');
    const signerName = formData.get('signerName') || 'Guest';
    const signerEmail = formData.get('signerEmail') || '';
    const envelopeId = formData.get('envelopeId') || `ENV-${Date.now()}`;

    if (!pdfFile) throw new Error('Missing PDF');
    if (!fieldsStr) throw new Error('Missing Fields');

    let fields;
    try { fields = JSON.parse(fieldsStr); } catch(e) { throw new Error("Invalid JSON"); }

    const timestamp = new Date().toUTCString();
    
    // IP LOGIC
    let ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'Unknown';
    if (ip.includes('::ffff:')) ip = ip.split('::ffff:')[1];

    const originalPdfBytes = new Uint8Array(await pdfFile.arrayBuffer());
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

    // DRAW VISUALS
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
            
            const sigWidth = 120;
            const sigHeight = (pngImage.height / pngImage.width) * sigWidth;
            const blockHeight = sigHeight + 12;
            const drawY = y - blockHeight;

            page.drawText('eSigned by:', {
                x: x + 5, 
                y: drawY + sigHeight + 4,
                size: 9,
                font: fontBold,
                color: rgb(0.2, 0.2, 0.2)
            });

            page.drawImage(pngImage, { 
                x: x + 10, 
                y: drawY + 6,
                width: sigWidth, 
                height: sigHeight 
            });

            const uniqueId = field.uuid || signatureUUID;
            page.drawText(uniqueId, {
                x: x + 5,
                y: drawY - 2,
                size: 7,
                font: font,
                color: rgb(0.4, 0.4, 0.4)
            });

            const bracketColor = rgb(0, 0.35, 0.65);
            page.drawLine({
                start: { x: x, y: drawY - 2 },
                end: { x: x, y: drawY + blockHeight },
                thickness: 2,
                color: bracketColor
            });
            page.drawLine({
                start: { x: x, y: drawY + blockHeight },
                end: { x: x + 8, y: drawY + blockHeight },
                thickness: 2,
                color: bracketColor
            });
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

    // AUDIT TRAIL PAGE
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
    
    if (signatureSpecimen) {
        yPos -= 40;
        audit.drawText('Signature Specimen:', { x: 50, y: yPos, size: 14, font: fontBold });
        yPos -= 10;
        
        const sigWidth = 120;
        const sigHeight = (signatureSpecimen.height / signatureSpecimen.width) * sigWidth;
        const blockHeight = sigHeight + 12;
        const startX = 50;
        const drawY = yPos - blockHeight;

        audit.drawText('eSigned by:', { x: startX + 5, y: drawY + sigHeight + 4, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        audit.drawImage(signatureSpecimen, { x: startX + 10, y: drawY + 6, width: sigWidth, height: sigHeight });
        audit.drawText(signatureUUID, { x: startX + 5, y: drawY - 2, size: 7, font: font, color: rgb(0.4, 0.4, 0.4) });
        
        const bracketColor = rgb(0, 0.35, 0.65);
        audit.drawLine({ start: { x: startX, y: drawY - 2 }, end: { x: startX, y: drawY + blockHeight }, thickness: 2, color: bracketColor });
        audit.drawLine({ start: { x: startX, y: drawY + blockHeight }, end: { x: startX + 8, y: drawY + blockHeight }, thickness: 2, color: bracketColor });
        audit.drawLine({ start: { x: startX, y: drawY - 2 }, end: { x: startX + 8, y: drawY - 2 }, thickness: 2, color: bracketColor });
    }

    const visualPdfBuffer = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));

    const placeholderResult = plainAddPlaceholder({
        pdfBuffer: visualPdfBuffer,
        reason: 'Digitally Signed',
        signatureLength: 16000,
    });
    const pdfToSign = Buffer.isBuffer(placeholderResult) ? placeholderResult : Buffer.from(placeholderResult.pdf);

    const activeP12Buffer = generateIdentity();
    const signer = new P12Signer(activeP12Buffer, { passphrase: 'password' });
    const signPdf = new SignPdf();
    const signedPdf = await signPdf.sign(pdfToSign, signer);

    return new Response(signedPdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="signed_${envelopeId}.pdf"`,
      }
    });

  } catch (err) {
    console.error('❌ Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
