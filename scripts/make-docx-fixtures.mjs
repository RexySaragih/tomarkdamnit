#!/usr/bin/env node
// Writes images.docx: a minimal Word package with two inline PNGs
// (one with alt text, one without).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { strToU8, zipSync } from "fflate";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures");
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const EMU_PER_INCH = 914400;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`;

function inlineImage(id, descr) {
  const descrAttr = descr ? ` descr="${descr}"` : "";
  return `<w:p><w:r><w:drawing><wp:inline>
    <wp:extent cx="${EMU_PER_INCH}" cy="${EMU_PER_INCH}"/>
    <wp:docPr id="${id}" name="Picture ${id}"${descrAttr}/>
    <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
      <pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="image1.png"/><pic:cNvPicPr/></pic:nvPicPr>
        <pic:blipFill><a:blip r:embed="rIdImg"/></pic:blipFill>
        <pic:spPr/></pic:pic>
    </a:graphicData></a:graphic>
  </wp:inline></w:drawing></w:r></w:p>`;
}

const DOCUMENT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    <w:p><w:r><w:t>Before images</w:t></w:r></w:p>
    ${inlineImage(1, "Quarterly revenue [chart]")}
    ${inlineImage(2, "")}
    <w:p><w:r><w:t>After images</w:t></w:r></w:p>
  </w:body>
</w:document>`;

const docx = zipSync({
  "[Content_Types].xml": strToU8(CONTENT_TYPES),
  "_rels/.rels": strToU8(ROOT_RELS),
  "word/document.xml": strToU8(DOCUMENT),
  "word/_rels/document.xml.rels": strToU8(DOC_RELS),
  "word/media/image1.png": PNG_1X1,
});
writeFileSync(join(FIXTURES, "images.docx"), docx);
console.log("Wrote images.docx");
