const { Resend } = require("resend");
const { storeSubmission } = require("../submission-store");
const { storeSupabaseSubmission } = require("../supabase");

const PAGE = { width: 612, height: 792, margin: 42 };
const FONT = { body: "F1", bold: "F2" };

const SERVICE_FIELDS = [
  ["Bathing / Hygiene Assistance", "serviceBathingHygiene"],
  ["Grooming", "serviceGrooming"],
  ["Dressing Assistance", "serviceDressing"],
  ["Toileting / Incontinence Care", "serviceToileting"],
  ["Mobility / Transfers", "serviceMobilityTransfers"],
  ["Meal Preparation", "serviceMealPreparation"],
  ["Feeding Assistance", "serviceFeeding"],
  ["Light Housekeeping", "serviceHousekeeping"],
  ["Laundry", "serviceLaundry"],
  ["Safety Supervision", "serviceSafetySupervision"],
  ["Companionship", "serviceCompanionship"],
  ["Errands / Shopping", "serviceErrands"],
  ["Other", "serviceOther"]
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

function safeDate(valueText) {
  return normalizeText(valueText).replace(/[^0-9-]+/g, "") || new Date().toISOString().slice(0, 10);
}

function pdfFileName(visitNote) {
  return `${safeName(visitNote.clientName)}_Visit_Note_${safeDate(visitNote.dateOfService)}.pdf`;
}

function selectedServices(visitNote) {
  const services = SERVICE_FIELDS
    .filter(([, key]) => visitNote[key] === true || value(visitNote, key) === "on")
    .map(([label]) => label);

  const otherServices = value(visitNote, "otherServices");
  if (otherServices && !services.includes("Other")) services.push("Other");
  return { services, otherServices };
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
    text("Visit Note / Care Log (CRS-CL04)", 187, 724, 15, FONT.bold);
    line(PAGE.margin, 710, PAGE.width - PAGE.margin, 710, 1);
    y = 690;
  }

  function section(titleText) {
    ensure(32);
    fillRect(PAGE.margin, y - 4, PAGE.width - PAGE.margin * 2, 18);
    text(titleText.toUpperCase(), PAGE.margin + 7, y + 1, 10, FONT.bold, 1);
    y -= 27;
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
    y -= 11;
  }

  function fullBox(label, fieldValue, minHeight = 34) {
    const normalized = normalizeText(fieldValue);
    if (!normalized) return;
    const lines = wrapText(normalized, 96);
    const height = Math.max(minHeight, 20 + lines.length * 10);
    ensure(height + 6);
    rect(PAGE.margin, y - height, PAGE.width - PAGE.margin * 2, height);
    text(label, PAGE.margin + 5, y - 11, 8, FONT.bold);
    lines.forEach((lineText, index) => {
      text(lineText, PAGE.margin + 5, y - 24 - index * 10, 8);
    });
    y -= height + 8;
  }

  function checkboxList(items) {
    if (!items.length) return;
    const lineHeight = 13;
    ensure(items.length * lineHeight + 14);
    items.forEach((item) => {
      text(`[X] ${item}`, PAGE.margin + 3, y, 9);
      y -= lineHeight;
    });
    y -= 4;
  }

  function finish() {
    pages.push(stream);
    return pages;
  }

  return { title, section, table, fullBox, checkboxList, finish };
}

function buildPdfPages(visitNote) {
  const pdf = createPdfContext();
  const { services, otherServices } = selectedServices(visitNote);
  pdf.title();

  pdf.section("Visit Information");
  pdf.table(
    ["Client", "Date", "Attendant", "Arrival / Departure"],
    [[
      value(visitNote, "clientName"),
      value(visitNote, "dateOfService"),
      value(visitNote, "attendantName"),
      `${value(visitNote, "arrivalTime")} / ${value(visitNote, "departureTime")}`
    ]],
    [135, 85, 155, 155]
  );

  pdf.section("Services Provided");
  pdf.checkboxList(services);
  pdf.fullBox("Other services provided", otherServices, 34);

  pdf.section("Client Condition / Observations");
  pdf.table(["Condition Today"], [[value(visitNote, "clientCondition")]], [530]);
  pdf.fullBox("Notes / observations", value(visitNote, "observationNotes"), 46);

  pdf.section("Incidents / Concerns");
  pdf.table(["Incident, injury, refusal, or unusual event?"], [[value(visitNote, "incidentOccurred")]], [530]);
  pdf.fullBox("Details", value(visitNote, "incidentDetails"), 42);

  pdf.section("Task Completion");
  pdf.table(["Services completed as planned?"], [[value(visitNote, "servicesCompleted")]], [530]);
  pdf.fullBox("Explanation", value(visitNote, "incompleteExplanation"), 42);

  pdf.section("Signatures");
  pdf.table(
    ["Attendant Signature", "Client / Responsible Party Signature", "Date Signed"],
    [[
      value(visitNote, "attendantSignature"),
      value(visitNote, "clientSignature"),
      value(visitNote, "signedDate")
    ]],
    [190, 220, 120]
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

function createClientVisitNotePdf(visitNote) {
  return buildPdfBuffer(buildPdfPages(visitNote));
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

function buildEmailHtml(visitNote, submittedAtDisplay) {
  return `
    <p>New CRS visit note submitted.</p>
    <p><strong>Client:</strong> ${escapeHtml(visitNote.clientName)}</p>
    <p><strong>Date of Service:</strong> ${escapeHtml(visitNote.dateOfService)}</p>
    <p><strong>Attendant:</strong> ${escapeHtml(visitNote.attendantName)}</p>
    <p><strong>Client condition:</strong> ${escapeHtml(visitNote.clientCondition)}</p>
    <p><strong>Submitted:</strong> ${escapeHtml(submittedAtDisplay)}</p>
  `;
}

async function sendEmail({ visitNote, submittedAtDisplay, pdfBuffer }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY environment variable.");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "info@communityregenerativesolutions.com",
    subject: `New CRS Visit Note - ${normalizeText(visitNote.clientName) || "Client"}`,
    html: buildEmailHtml(visitNote, submittedAtDisplay),
    attachments: [
      {
        filename: pdfFileName(visitNote),
        content: pdfBuffer
      }
    ]
  });

  if (error) {
    console.error("Resend visit note email failed:", error);
    throw new Error(`Resend email failed: ${error.message || JSON.stringify(error)}`);
  }

  console.info("Resend visit note email sent:", data);
  return data;
}

module.exports = async function handler(req, res) {
  console.info("CRS route started: /api/submit-client-visit-note", { method: req.method });
  console.info("CRS route /api/submit-client-visit-note: supabase helper loaded", {
    storeSupabaseSubmission: typeof storeSupabaseSubmission === "function"
  });
  console.info("CRS route /api/submit-client-visit-note: env vars present", {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY)
  });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const visitNote = body.visitNote || body || {};
    const dateSubmitted = body.submittedAt || new Date().toISOString();
    const submittedAtDisplay = body.submittedAtDisplay || new Date().toLocaleString();
    const pdfBuffer = createClientVisitNotePdf(visitNote);
    const generatedPdfFileName = pdfFileName(visitNote);
    const emailResult = await sendEmail({ visitNote, submittedAtDisplay, pdfBuffer });
    const supabaseSubmission = await storeSupabaseSubmission({
      fullName: normalizeText(visitNote.clientName),
      email: "",
      submissionType: "client-visit-note",
      pdfBuffer,
      pdfFileName: generatedPdfFileName,
      createdAt: dateSubmitted
    });
    const storedSubmission = await storeSubmission({
      fullName: normalizeText(visitNote.clientName),
      email: "",
      submissionType: "client-visit-note",
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
    console.error("CRS visit note submission failed:", error);
    return res.status(500).json({
      error: error.message || "Visit note submission failed."
    });
  }
};
