import pdfParse from 'pdf-parse';

export async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  const pageTexts: string[] = [];
  const data = await pdfParse(buffer, {
    pagerender: (pageData: any) => {
      return pageData.getTextContent().then((content: any) => {
        const text = content.items.map((item: any) => item.str).join(' ');
        pageTexts.push(text);
        return text;
      });
    }
  });
  if (pageTexts.length === 0 && data.text) {
    // fallback: pagerender may not have fired (some PDF versions)
    return data.text;
  }
  return pageTexts
    .map((text, i) => `--- PAGE ${i + 1} ---\n${text}`)
    .join('\n\n');
}
