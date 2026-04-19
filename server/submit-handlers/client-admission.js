const { Resend } = require("resend");
const { storeSubmission } = require("../submission-store");
const { storeSupabaseSubmission } = require("../supabase");

const PAGE = { width: 612, height: 792, margin: 42 };
const FONT = { body: "F1", bold: "F2" };

const ADMISSION_SECTIONS = [
  [
    "1. Introduction",
    [
      "Community Regenerative Solutions provides private-pay personal assistance services designed to support safety, independence, and daily functioning in the home. This admission packet explains the basic terms of service and the expectations for clients, responsible parties, and CRS staff."
    ]
  ],
  [
    "2. Service Agreement",
    [
      "CRS provides non-skilled personal assistance services only. Services may include help with personal care, mobility support, meal preparation, light housekeeping, supervision, and other approved daily living tasks. CRS staff do not provide skilled nursing services, medical treatment, medical decision-making, or medication administration.",
      "Services are provided according to the agreed schedule and service plan. Any requested change in services should be communicated to CRS so the plan can be reviewed and updated when appropriate."
    ]
  ],
  [
    "3. Scheduling & Attendance",
    [
      "CRS will make reasonable efforts to provide services according to the agreed schedule. Clients or responsible parties should notify CRS as soon as possible if a visit needs to be canceled, changed, or rescheduled. Staff assignments and schedules may vary based on availability, client needs, and agency operations."
    ]
  ],
  [
    "4. Billing & Payment",
    [
      "Private-pay services are billed according to the rate and payment arrangement agreed upon before services begin. Payment is expected according to the agreed billing schedule. Questions about invoices, payment timing, or service charges should be directed to CRS as soon as possible so they can be reviewed."
    ]
  ],
  [
    "5. Client Rights",
    [
      "Clients have the right to be treated with dignity, respect, privacy, and consideration. Clients have the right to participate in planning their services, ask questions, voice concerns, refuse services, and receive care without discrimination, abuse, neglect, or exploitation."
    ]
  ],
  [
    "6. Client Responsibilities",
    [
      "Clients and responsible parties are expected to provide accurate information, maintain a reasonably safe environment for services, communicate changes in condition or schedule, and treat CRS staff respectfully. Clients should notify CRS if needs change or if there are concerns about service delivery."
    ]
  ],
  [
    "7. Privacy & Confidentiality",
    [
      "CRS respects client privacy and protects personal information. Client information is shared only as needed for service coordination, billing, compliance, safety, or as otherwise authorized by the client or required by law."
    ]
  ],
  [
    "8. Complaint Process",
    [
      "Clients and responsible parties may report complaints, concerns, or service issues to CRS at any time. CRS will review concerns professionally and make reasonable efforts to resolve issues promptly. Reporting a complaint will not result in retaliation or a reduction in respectful treatment."
    ]
  ],
  [
    "10. Acknowledgment & Consent",
    [
      "By signing below, the client or responsible party acknowledges that they have reviewed this admission packet, understand that CRS provides non-skilled personal assistance services only, and consent to receive services according to the agreed service plan and schedule."
    ]
  ]
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

function safeName(valueText) {
  return normalizeText(valueText)
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_|_$/g, "") || "Client";
}

function pdfFileName(admission) {
  return `${safeName(admission.clientName)}_Client_Admission.pdf`;
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
    if (y - spaceNeeded < PAGE.margin) addPage();
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
    text("Client Admission Packet (CRS-CL06)", 175, 724, 15, FONT.bold);
    line(PAGE.margin, 710, PAGE.width - PAGE.margin, 710, 1);
    y = 690;
  }

  function section(titleText) {
    ensure(30);
    fillRect(PAGE.margin, y - 4, PAGE.width - PAGE.margin * 2, 18);
    text(titleText.toUpperCase(), PAGE.margin + 7, y + 1, 10, FONT.bold, 1);
    y -= 27;
  }

  function paragraph(textValue) {
    const lines = wrapText(textValue, 96);
    ensure(lines.length * 11 + 8);
    lines.forEach((lineText) => {
      text(lineText, PAGE.margin, y, 9);
      y -= 11;
    });
    y -= 7;
  }

  function table(headers, rows, columnWidths) {
    if (!rows.length) return;
    const rowHeight = 24;
    const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
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
          text(part, x + 4, y - 10 - lineIndex * 9, 8);
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

  return { title, section, paragraph, table, finish };
}

function releaseRows(admission) {
  return [
    value(admission, "releaseNameOne"),
    value(admission, "releaseNameTwo"),
    value(admission, "releaseNameThree")
  ]
    .filter(Boolean)
    .map((name, index) => [`${index + 1}`, name]);
}

function buildPdfPages(admission) {
  const pdf = createPdfContext();
  pdf.title();

  ADMISSION_SECTIONS.slice(0, 8).forEach(([titleText, paragraphs]) => {
    pdf.section(titleText);
    paragraphs.forEach((paragraphText) => pdf.paragraph(paragraphText));
  });

  pdf.section("9. Release of Information");
  pdf.paragraph("If the client wants CRS to communicate with specific family members, responsible parties, or other contacts about services, list those names below. This section is optional and may be updated later.");
  const releases = releaseRows(admission);
  if (releases.length) {
    pdf.table(["#", "Authorized Person / Organization"], releases, [40, 490]);
  } else {
    pdf.paragraph("No release of information names were listed.");
  }

  ADMISSION_SECTIONS.slice(8).forEach(([titleText, paragraphs]) => {
    pdf.section(titleText);
    paragraphs.forEach((paragraphText) => pdf.paragraph(paragraphText));
  });

  pdf.table(
    ["Acknowledgment", "Status"],
    [["I acknowledge and consent to the terms explained in this Client Admission Packet.", value(admission, "acknowledgmentConsent")]],
    [420, 110]
  );

  pdf.section("11. Signature");
  pdf.table(
    ["Client / Responsible Party Name", "Signature", "Date"],
    [[value(admission, "clientName"), value(admission, "signature"), value(admission, "signatureDate")]],
    [210, 210, 110]
  );

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

function createClientAdmissionPdf(admission) {
  return buildPdfBuffer(buildPdfPages(admission));
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

function buildEmailHtml(admission, submittedAtDisplay) {
  return `
    <p>New CRS client admission packet submitted.</p>
    <p><strong>Client / Responsible Party:</strong> ${escapeHtml(admission.clientName)}</p>
    <p><strong>Signature Date:</strong> ${escapeHtml(admission.signatureDate)}</p>
    <p><strong>Submitted:</strong> ${escapeHtml(submittedAtDisplay)}</p>
  `;
}

async function sendEmail({ admission, submittedAtDisplay, pdfBuffer }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY environment variable.");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "info@communityregenerativesolutions.com",
    subject: `New CRS Client Admission - ${normalizeText(admission.clientName) || "Client"}`,
    html: buildEmailHtml(admission, submittedAtDisplay),
    attachments: [
      {
        filename: pdfFileName(admission),
        content: pdfBuffer
      }
    ]
  });

  if (error) {
    console.error("Resend client admission email failed:", error);
    throw new Error(`Resend email failed: ${error.message || JSON.stringify(error)}`);
  }

  console.info("Resend client admission email sent:", data);
  return data;
}

module.exports = async function handler(req, res) {
  console.info("CRS route started: /api/submit-client-admission", { method: req.method });
  console.info("CRS route /api/submit-client-admission: supabase helper loaded", {
    storeSupabaseSubmission: typeof storeSupabaseSubmission === "function"
  });
  console.info("CRS route /api/submit-client-admission: env vars present", {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY)
  });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const admission = body.admission || body || {};
    const dateSubmitted = body.submittedAt || new Date().toISOString();
    const submittedAtDisplay = body.submittedAtDisplay || new Date().toLocaleString();
    const pdfBuffer = createClientAdmissionPdf(admission);
    const generatedPdfFileName = pdfFileName(admission);
    const emailResult = await sendEmail({ admission, submittedAtDisplay, pdfBuffer });
    const supabaseSubmission = await storeSupabaseSubmission({
      fullName: normalizeText(admission.clientName),
      email: "",
      submissionType: "client-admission",
      pdfBuffer,
      pdfFileName: generatedPdfFileName,
      createdAt: dateSubmitted
    });
    const storedSubmission = await storeSubmission({
      fullName: normalizeText(admission.clientName),
      email: "",
      submissionType: "client-admission",
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
    console.error("CRS client admission submission failed:", error);
    return res.status(500).json({
      error: error.message || "Client admission submission failed."
    });
  }
};
