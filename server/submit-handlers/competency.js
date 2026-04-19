const { Resend } = require("resend");
const { storeSubmission } = require("../submission-store");
const { storeSupabaseSubmission } = require("../supabase");

const PAGE = { width: 612, height: 792, margin: 42 };
const FONT = { body: "F1", bold: "F2" };

const COMPETENCY_ITEMS = [
  [
    "Personal Care Assistance",
    "Demonstrates ability to assist with bathing, grooming, dressing, and hygiene safely and respectfully.",
    "personalCare"
  ],
  [
    "Mobility / Transfers",
    "Demonstrates safe assistance with ambulation, positioning, and transfers within assigned scope.",
    "mobilityTransfers"
  ],
  [
    "Toileting / Incontinence Care",
    "Demonstrates proper assistance with toileting and incontinence care while maintaining dignity and cleanliness.",
    "toiletingCare"
  ],
  [
    "Meal Preparation",
    "Demonstrates ability to prepare meals and assist with feeding as authorized.",
    "mealPreparation"
  ],
  [
    "Light Housekeeping",
    "Demonstrates ability to complete assigned household tasks in client care areas.",
    "lightHousekeeping"
  ],
  [
    "Infection Control",
    "Demonstrates proper handwashing, glove use, and infection control practices.",
    "infectionControl"
  ],
  [
    "Documentation / Reporting",
    "Demonstrates understanding of accurate documentation and reporting changes in client condition.",
    "documentationReporting"
  ],
  [
    "Professionalism / Communication",
    "Demonstrates respectful communication, punctuality, and appropriate interaction with clients and supervisors.",
    "professionalismCommunication"
  ],
  [
    "Client Safety Awareness",
    "Demonstrates awareness of fall prevention, environmental safety, and emergency response expectations.",
    "clientSafety"
  ],
  [
    "Prohibited Tasks",
    "Demonstrates understanding of tasks not allowed, including no skilled nursing tasks and no medication administration.",
    "prohibitedTasks"
  ]
];

function normalizeText(value) {
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

function isRating(data, prefix, rating) {
  if (rating === "Competent") {
    return data[`${prefix}Competent`] === true || value(data, `${prefix}Competent`) === "on" ? "Yes" : "";
  }

  return data[`${prefix}NeedsImprovement`] === true || value(data, `${prefix}NeedsImprovement`) === "on" ? "Yes" : "";
}

function pdfFileName(evaluation) {
  const safeName = value(evaluation, "employeeFullName")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_|_$/g, "");

  return `${safeName || "Employee"}_Competency_Evaluation.pdf`;
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
    text("PAS Attendant Competency Evaluation", 168, 724, 15, FONT.bold);
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

  function table(headers, rows, columnWidths) {
    if (!rows.length) return;
    const totalWidth = columnWidths.reduce((sum, item) => sum + item, 0);
    const startX = PAGE.margin;
    const rowHeight = 34;
    ensure(rowHeight * (rows.length + 1) + 8);

    rect(startX, y - rowHeight, totalWidth, rowHeight);
    let x = startX;
    headers.forEach((header, index) => {
      if (index > 0) line(x, y, x, y - rowHeight);
      text(header, x + 4, y - 20, 8, FONT.bold);
      x += columnWidths[index];
    });
    y -= rowHeight;

    rows.forEach((row) => {
      ensure(rowHeight + 4);
      rect(startX, y - rowHeight, totalWidth, rowHeight);
      x = startX;
      row.forEach((cell, index) => {
        if (index > 0) line(x, y, x, y - rowHeight);
        wrapText(cell, Math.floor((columnWidths[index] - 8) / 5.2)).slice(0, 3).forEach((part, lineIndex) => {
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

  return { title, section, fieldRow, table, finish };
}

function buildPdfPages(evaluation) {
  const pdf = createPdfContext();
  pdf.title();

  pdf.section("Evaluation Information");
  pdf.fieldRow([
    ["Employee Full Legal Name", value(evaluation, "employeeFullName")],
    ["Job Title", value(evaluation, "jobTitle") || "PAS Attendant"]
  ]);
  pdf.fieldRow([
    ["Evaluator / Supervisor Name", value(evaluation, "evaluatorName")],
    ["Evaluation Date", value(evaluation, "evaluationDate")]
  ]);

  pdf.section("Competency Results");
  pdf.table(
    ["Category", "Criteria", "Competent", "Needs Improvement", "Comments"],
    COMPETENCY_ITEMS.map(([label, criteria, prefix]) => [
      label,
      criteria,
      isRating(evaluation, prefix, "Competent"),
      isRating(evaluation, prefix, "Needs improvement"),
      value(evaluation, `${prefix}Comments`)
    ]),
    [120, 190, 65, 85, 70]
  );

  pdf.section("Overall Comments and Recommendation");
  pdf.table(
    ["Overall Comments", "Competent for Assignment", "Needs Additional Training"],
    [[
      value(evaluation, "overallComments"),
      evaluation.recommendationCompetent === true || value(evaluation, "recommendationCompetent") === "on" ? "Yes" : "",
      evaluation.recommendationNeedsTraining === true || value(evaluation, "recommendationNeedsTraining") === "on" ? "Yes" : ""
    ]],
    [320, 105, 105]
  );

  pdf.section("Evaluator Certification");
  pdf.fieldRow([
    ["Evaluator Typed Name", value(evaluation, "certifierName")],
    ["Evaluator Signature", value(evaluation, "certifierSignature")]
  ]);
  pdf.fieldRow([
    ["Date", value(evaluation, "certificationDate")]
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

function createCompetencyEvaluationPdf(evaluation) {
  return buildPdfBuffer(buildPdfPages(evaluation));
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

function buildEmailHtml(evaluation, submittedAtDisplay) {
  return `
    <p>New CRS PAS attendant competency evaluation submitted.</p>
    <p><strong>Employee:</strong> ${escapeHtml(evaluation.employeeFullName)}</p>
    <p><strong>Evaluator:</strong> ${escapeHtml(evaluation.evaluatorName)}</p>
    <p><strong>Evaluation Date:</strong> ${escapeHtml(evaluation.evaluationDate)}</p>
    <p><strong>Submitted:</strong> ${escapeHtml(submittedAtDisplay)}</p>
  `;
}

async function sendEmail({ evaluation, submittedAtDisplay, pdfBuffer }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY environment variable.");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "info@communityregenerativesolutions.com",
    subject: `New CRS Competency Evaluation - ${normalizeText(evaluation.employeeFullName) || "Employee"}`,
    html: buildEmailHtml(evaluation, submittedAtDisplay),
    attachments: [
      {
        filename: pdfFileName(evaluation),
        content: pdfBuffer
      }
    ]
  });

  if (error) {
    console.error("Resend competency email failed:", error);
    throw new Error(`Resend email failed: ${error.message || JSON.stringify(error)}`);
  }

  console.info("Resend competency email sent:", data);
  return data;
}

module.exports = async function handler(req, res) {
  console.info("CRS route started: /api/submit-competency", { method: req.method });
  console.info("CRS route /api/submit-competency: supabase helper loaded", {
    storeSupabaseSubmission: typeof storeSupabaseSubmission === "function"
  });
  console.info("CRS route /api/submit-competency: env vars present", {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY)
  });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const evaluation = body.evaluation || body || {};
    const dateSubmitted = body.submittedAt || new Date().toISOString();
    const submittedAtDisplay = body.submittedAtDisplay || new Date().toLocaleString();
    const pdfBuffer = createCompetencyEvaluationPdf(evaluation);
    const emailResult = await sendEmail({ evaluation, submittedAtDisplay, pdfBuffer });
    const supabaseSubmission = await storeSupabaseSubmission({
      fullName: normalizeText(evaluation.employeeFullName),
      email: "",
      submissionType: "competency",
      pdfBuffer,
      createdAt: dateSubmitted
    });
    const storedSubmission = await storeSubmission({
      fullName: normalizeText(evaluation.employeeFullName),
      email: "",
      submissionType: "competency",
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
    console.error("CRS competency evaluation submission failed:", error);
    return res.status(500).json({
      error: error.message || "Competency evaluation submission failed."
    });
  }
};
