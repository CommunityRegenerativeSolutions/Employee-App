const { Resend } = require("resend");
const { storeSubmission } = require("../submission-store");
const { storeSupabaseSubmission } = require("../supabase");

const PAGE = { width: 612, height: 792, margin: 42 };
const FONT = { body: "F1", bold: "F2" };
const AUTHORIZATION_TEXT = [
  "I authorize Community Regenerative Solutions to obtain background checks as required by Texas HHSC regulations. This includes, but is not limited to:",
  "- Texas Department of Public Safety (DPS) Criminal History Check",
  "- Employee Misconduct Registry (EMR)",
  "- Nurse Aide Registry (NAR)",
  "I understand that this information will be used solely for employment eligibility and compliance purposes. I acknowledge that providing false or incomplete information may result in disqualification or termination."
];

function normalizeText(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";

  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

function escapePdfText(value) {
  return normalizeText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

function escapeHtml(value) {
  return normalizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function wrapText(value, maxChars) {
  const words = normalizeText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
      return;
    }
    line = next;
  });

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function value(data, key) {
  return normalizeText(data[key]);
}

function checked(valueText) {
  return normalizeText(valueText) ? "Yes" : "";
}

function pdfFileName(authorization) {
  const safeName = value(authorization, "fullName")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_|_$/g, "");

  return `${safeName || "Employee"}_Background_Authorization.pdf`;
}

function createPdfContext() {
  const pages = [];
  let stream = [];
  let y = 732;

  function push(command) {
    stream.push(command);
  }

  function addPage() {
    pages.push(stream);
    stream = [];
    y = 732;
  }

  function ensure(spaceNeeded) {
    if (y - spaceNeeded < PAGE.margin) {
      addPage();
    }
  }

  function text(textValue, x, yPos, size = 9, font = FONT.body, color = 0) {
    push(`${color} g BT /${font} ${size} Tf ${x} ${yPos} Td (${escapePdfText(textValue)}) Tj ET`);
  }

  function line(x1, y1, x2, y2, width = 0.7) {
    push(`0 G ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
  }

  function rect(x, yPos, width, height) {
    push(`0 G 0.7 w ${x} ${yPos} ${width} ${height} re S`);
  }

  function fillRect(x, yPos, width, height) {
    push(`0 g ${x} ${yPos} ${width} ${height} re f`);
  }

  function title() {
    text("Community Regenerative Solutions", 132, 748, 18, FONT.bold);
    text("Background Check Authorization", 190, 724, 15, FONT.bold);
    line(PAGE.margin, 710, PAGE.width - PAGE.margin, 710, 1);
    y = 690;
  }

  function section(titleText) {
    ensure(34);
    fillRect(PAGE.margin, y - 4, PAGE.width - PAGE.margin * 2, 18);
    text(titleText.toUpperCase(), PAGE.margin + 7, y + 1, 10, FONT.bold, 1);
    y -= 26;
  }

  function field(label, fieldValue, x, width, options = {}) {
    const lineY = y - 18;
    text(label, x, y, options.labelSize || 7, FONT.bold);
    line(x, lineY, x + width, lineY);
    wrapText(fieldValue, Math.max(12, Math.floor(width / 5.2))).slice(0, options.maxLines || 2).forEach((part, index) => {
      text(part, x + 2, lineY + 4 - index * 10, options.valueSize || 9);
    });
  }

  function fieldRow(fields, height = 36) {
    ensure(height + 4);
    const gap = 12;
    const width = (PAGE.width - PAGE.margin * 2 - gap * (fields.length - 1)) / fields.length;
    fields.forEach(([label, fieldValue], index) => {
      field(label, fieldValue, PAGE.margin + index * (width + gap), width);
    });
    y -= height;
  }

  function fullField(label, fieldValue, height = 42) {
    ensure(height + 4);
    field(label, fieldValue, PAGE.margin, PAGE.width - PAGE.margin * 2, { maxLines: 3 });
    y -= height;
  }

  function paragraph(lines) {
    const sourceLines = Array.isArray(lines) ? lines : [lines];
    sourceLines.forEach((sourceLine) => {
      const x = sourceLine.startsWith("-") ? PAGE.margin + 12 : PAGE.margin;
      const wrapped = wrapText(sourceLine, sourceLine.startsWith("-") ? 90 : 95);
      ensure(wrapped.length * 11 + 8);
      wrapped.forEach((lineText) => {
        text(lineText, x, y, 9);
        y -= 11;
      });
      y -= 5;
    });
    y -= 4;
  }

  function table(headers, rows, columnWidths) {
    if (!rows.length) return;
    const totalWidth = columnWidths.reduce((sum, item) => sum + item, 0);
    const rowHeight = 24;
    const startX = PAGE.margin;
    ensure(rowHeight * (rows.length + 1) + 8);

    rect(startX, y - rowHeight, totalWidth, rowHeight);
    let x = startX;
    headers.forEach((header, index) => {
      if (index > 0) line(x, y, x, y - rowHeight);
      text(header, x + 4, y - 15, 8, FONT.bold);
      x += columnWidths[index];
    });
    y -= rowHeight;

    rows.forEach((row) => {
      ensure(rowHeight + 4);
      rect(startX, y - rowHeight, totalWidth, rowHeight);
      x = startX;
      row.forEach((cell, index) => {
        if (index > 0) line(x, y, x, y - rowHeight);
        wrapText(cell, Math.floor((columnWidths[index] - 8) / 5.2)).slice(0, 2).forEach((part, lineIndex) => {
          text(part, x + 4, y - 11 - lineIndex * 9, 8);
        });
        x += columnWidths[index];
      });
      y -= rowHeight;
    });
    y -= 12;
  }

  function finish() {
    pages.push(stream);
    return pages;
  }

  return { title, section, fieldRow, fullField, paragraph, table, finish };
}

function buildPdfPages(authorization) {
  const pdf = createPdfContext();
  pdf.title();

  pdf.section("Employee Information");
  pdf.fieldRow([
    ["Full Legal Name", value(authorization, "fullName")],
    ["Date of Birth", value(authorization, "dateOfBirth")]
  ]);
  pdf.fieldRow([
    ["Last 4 of SSN", value(authorization, "ssnLast4")]
  ]);
  pdf.fullField("Current Address", value(authorization, "currentAddress"), 48);

  pdf.section("Authorization Text");
  pdf.paragraph(AUTHORIZATION_TEXT);

  pdf.section("Acknowledgment");
  pdf.table(
    ["Acknowledgment", "Checked"],
    [["I authorize CRS to perform the required background checks", checked(authorization.backgroundAuthorization)]],
    [440, 90]
  );

  pdf.section("Signature");
  pdf.fieldRow([
    ["Employee Full Name", value(authorization, "employeeSignatureName")],
    ["Signature", value(authorization, "signature")]
  ]);
  pdf.fieldRow([
    ["Date", value(authorization, "signatureDate")]
  ]);

  return pdf.finish();
}

function buildPdfBuffer(pageStreams) {
  const objects = [];
  function addObject(body) {
    objects.push(body);
    return objects.length;
  }

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds = [];

  pageStreams.forEach((stream) => {
    const content = stream.join("\n");
    const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

function createBackgroundAuthorizationPdf(authorization) {
  return buildPdfBuffer(buildPdfPages(authorization));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  const rawBody = Buffer.concat(chunks).toString("utf8");
  const contentType = req.headers["content-type"] || "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(rawBody));
  }

  return JSON.parse(rawBody || "{}");
}

function buildEmailHtml(authorization, submittedAtDisplay) {
  return `
    <p>New CRS background check authorization submitted.</p>
    <p><strong>Employee:</strong> ${escapeHtml(authorization.fullName)}</p>
    <p><strong>Date of Birth:</strong> ${escapeHtml(authorization.dateOfBirth)}</p>
    <p><strong>Last 4 of SSN:</strong> ${escapeHtml(authorization.ssnLast4)}</p>
    <p><strong>Submitted:</strong> ${escapeHtml(submittedAtDisplay)}</p>
  `;
}

async function sendEmail({ authorization, submittedAtDisplay, pdfBuffer }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY environment variable.");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "info@communityregenerativesolutions.com",
    subject: `New CRS Background Authorization - ${normalizeText(authorization.fullName) || "Employee"}`,
    html: buildEmailHtml(authorization, submittedAtDisplay),
    attachments: [
      {
        filename: pdfFileName(authorization),
        content: pdfBuffer
      }
    ]
  });

  if (error) {
    console.error("Resend background authorization email failed:", error);
    throw new Error(`Resend email failed: ${error.message || JSON.stringify(error)}`);
  }

  console.info("Resend background authorization email sent:", data);
  return data;
}

module.exports = async function handler(req, res) {
  console.info("CRS route started: /api/submit-background", { method: req.method });
  console.info("CRS route /api/submit-background: supabase helper loaded", {
    storeSupabaseSubmission: typeof storeSupabaseSubmission === "function"
  });
  console.info("CRS route /api/submit-background: env vars present", {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY)
  });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const authorization = body.authorization || body || {};
    const dateSubmitted = body.submittedAt || new Date().toISOString();
    const submittedAtDisplay = body.submittedAtDisplay || new Date().toLocaleString();
    const pdfBuffer = createBackgroundAuthorizationPdf(authorization);
    const emailResult = await sendEmail({ authorization, submittedAtDisplay, pdfBuffer });
    const supabaseSubmission = await storeSupabaseSubmission({
      fullName: normalizeText(authorization.fullName),
      email: "",
      submissionType: "background",
      pdfBuffer,
      createdAt: dateSubmitted
    });
    const storedSubmission = await storeSubmission({
      fullName: normalizeText(authorization.fullName),
      email: "",
      submissionType: "background",
      pdfFileName: supabaseSubmission.pdfFileName,
      pdfUrl: supabaseSubmission.pdfUrl,
      dateSubmitted
    });

    return res.status(200).json({
      ok: true,
      emailId: emailResult?.id,
      submissionId: supabaseSubmission.id || storedSubmission.id,
      pdfUrl: supabaseSubmission.pdfUrl
    });
  } catch (error) {
    console.error("CRS background authorization submission failed:", error);
    return res.status(500).json({
      error: error.message || "Background authorization submission failed."
    });
  }
};
