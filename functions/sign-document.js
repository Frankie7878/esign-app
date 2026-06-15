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
            let image;
            const isJpg = field.value.startsWith('data:image/jpeg') || field.value.startsWith('data:image/jpg');
            if (isJpg) {
                image = await pdfDoc.embedJpg(field.value);
            } else {
                image = await pdfDoc.embedPng(field.value);
            }
            
            // Capture for audit page
            if (!signatureSpecimen) {
                signatureSpecimen = image;
                signatureUUID = field.uuid || Math.random().toString(36).substring(2, 12).toUpperCase();
            }
            
            const sigWidth = 120;
            const sigHeight = (image.height / image.width) * sigWidth;
            const blockHeight = sigHeight + 12;
            const drawY = y - blockHeight;

            page.drawText('eSigned by:', {
                x: x + 5, 
                y: drawY + sigHeight + 4,
                size: 9,
                font: fontBold,
                color: rgb(0.2, 0.2, 0.2)
            });

            page.drawImage(image, { 
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
