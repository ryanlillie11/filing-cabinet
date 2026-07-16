import { PDFDocument, StandardFonts } from "pdf-lib";

/** Render a body-only email as a simple text PDF so it can be filed like any doc. */
export async function emailBodyToPdf(opts: {
  from: string;
  subject: string;
  date: string;
  body: string;
}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Courier);
  const fontSize = 10;
  const margin = 50;
  const pageWidth = 612;
  const pageHeight = 792;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = fontSize * 1.35;

  const wrap = (text: string): string[] => {
    const out: string[] = [];
    for (const raw of text.split(/\r?\n/)) {
      let line = "";
      for (const word of raw.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, fontSize) > maxWidth && line) {
          out.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      out.push(line);
    }
    return out;
  };

  const lines = [
    `From:    ${opts.from}`,
    `Date:    ${opts.date}`,
    `Subject: ${opts.subject}`,
    "-".repeat(72),
    "",
    ...wrap(opts.body),
  ];

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  for (const line of lines) {
    if (y < margin) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line.slice(0, 500), { x: margin, y, size: fontSize, font });
    y -= lineHeight;
  }
  return Buffer.from(await pdf.save());
}
