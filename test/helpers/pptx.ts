import { strToU8, zipSync } from "fflate";

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const REL_NS = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';
const SLIDE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide";
const NOTES_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide";

export interface SlideSpec {
  /** File number: written as ppt/slides/slide{file}.xml */
  file: number;
  /** Raw <p:spTree> children */
  shapes: string;
  hidden?: boolean;
  /** Raw <p:spTree> children for the notes slide */
  notes?: string;
}

export function textShape(text: string, placeholderType?: string): string {
  const ph = placeholderType ? `<p:nvPr><p:ph type="${placeholderType}"/></p:nvPr>` : "<p:nvPr/>";
  const paragraphs = text
    .split("\n")
    .map((line) => `<a:p><a:r><a:t>${line}</a:t></a:r></a:p>`)
    .join("");
  return `<p:sp><p:nvSpPr><p:cNvPr id="1" name="s"/><p:cNvSpPr/>${ph}</p:nvSpPr><p:txBody>${paragraphs}</p:txBody></p:sp>`;
}

export function tableShape(rows: string[][]): string {
  const cell = (text: string) =>
    `<a:tc><a:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></a:txBody></a:tc>`;
  const body = rows.map((r) => `<a:tr h="1">${r.map(cell).join("")}</a:tr>`).join("");
  return `<p:graphicFrame><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl>${body}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}

function slideXml(shapes: string, hidden = false): string {
  const show = hidden ? ' show="0"' : "";
  return `<?xml version="1.0"?><p:sld ${NS}${show}><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld></p:sld>`;
}

function notesXml(shapes: string): string {
  return `<?xml version="1.0"?><p:notes ${NS}><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld></p:notes>`;
}

function presentationParts(order: number[] | undefined): Record<string, Uint8Array> {
  if (!order) return {};
  const ids = order.map((file, i) => `<p:sldId id="${256 + i}" r:id="rIdS${file}"/>`).join("");
  const rels = order
    .map((file) => `<Relationship Type="${SLIDE_REL}" Target="slides/slide${file}.xml" Id="rIdS${file}"/>`)
    .join("");
  return {
    "ppt/presentation.xml": strToU8(`<?xml version="1.0"?><p:presentation ${NS}><p:sldIdLst>${ids}</p:sldIdLst></p:presentation>`),
    "ppt/_rels/presentation.xml.rels": strToU8(`<?xml version="1.0"?><Relationships ${REL_NS}>${rels}</Relationships>`),
  };
}

/**
 * Builds a minimal PPTX. `order` lists slide file numbers in presentation
 * order; omit it to produce a package without presentation.xml.
 */
export function buildPptx(slides: SlideSpec[], order?: number[]): Uint8Array {
  const files: Record<string, Uint8Array> = presentationParts(order);
  for (const slide of slides) {
    files[`ppt/slides/slide${slide.file}.xml`] = strToU8(slideXml(slide.shapes, slide.hidden));
    if (slide.notes === undefined) continue;
    files[`ppt/notesSlides/notesSlide${slide.file}.xml`] = strToU8(notesXml(slide.notes));
    files[`ppt/slides/_rels/slide${slide.file}.xml.rels`] = strToU8(
      `<?xml version="1.0"?><Relationships ${REL_NS}><Relationship Id="rIdN" Type="${NOTES_REL}" Target="../notesSlides/notesSlide${slide.file}.xml"/></Relationships>`
    );
  }
  return zipSync(files);
}
