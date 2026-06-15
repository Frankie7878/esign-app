import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import forge from 'node-forge';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { plainAddPlaceholder } from '@signpdf/placeholder-plain';

const P12_BASE64 = "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";

let p12Buffer;
function generateIdentity() {
  if (p12Buffer) return p12Buffer;
  p12Buffer = Buffer.from(P12_BASE64, 'base64');
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
