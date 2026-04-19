const { Resend } = require("resend");
const { storeSubmission } = require("../submission-store");
const { storeSupabaseSubmission } = require("../supabase");

const PAGE = { width: 612, height: 792, margin: 42 };
const FONT = { body: "F1", bold: "F2" };

const INCIDENT_TYPE_FIELDS = [
  ["Fall", "typeFall"],
  ["Injury", "typeInjury"],
  ["Refusal of Care", "typeRefusal"],
  ["Change in Condition", "typeConditionChange"],
  ["Behavioral Issue", "typeBehavioral"],
  ["Safety Hazard", "typeSafetyHazard"],
  ["Other", "typeOther"]
];

const ACTION_FIELDS = [
  ["Assisted client", "actionAssisted"],
  ["Provided basic first aid", "actionFirstAid"],
  ["Contacted supervisor", "actionSupervisor"],
  ["Contacted responsible party", "actionResponsibleParty"],
  ["Emergency services called (911)", "actionEmergencyServices"],
  ["No action required", "actionNone"],
  ["Other", "actionOther"]
];

const NOTIFICATION_FIELDS = [
  ["Supervisor notified", "notifySupervisor"],
  ["Responsible party notified", "notifyResponsibleParty"],
  ["Physician notified", "notifyPhysician"]
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

function pdfFileName(incidentReport) {
  return `${safeName(incidentReport.clientName)}_Incident_Report_${safeDate(incidentReport.incidentDate)}.pdf`;
}

function selectedList(data, fields, otherTextKey) {
  const selected = fields
    .filter(([, key]) => data[key] === true || value(data, key) === "on")
    .map(([label]) => label);

  const otherText = otherTextKey ? value(data, otherTextKey) : "";
  if (otherText && !selected.includes("Other")) selected.push("Other");
  return { selected, otherText };
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
    text("Incident Report (CRS-CL05)", 210, 724, 15, FONT.bold);
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

  function fullBox(label, fieldValue, minHeight = 36) {
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
    ensure(items.length * lineHeight + 12);
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

function buildPdfPages(incidentReport) {
  const pdf = createPdfContext();
  const incidentTypes = selectedList(incidentReport, INCIDENT_TYPE_FIELDS, "otherIncidentType");
  const actions = selectedList(incidentReport, ACTION_FIELDS, "otherActions");
  const notifications = selectedList(incidentReport, NOTIFICATION_FIELDS);
  pdf.title();

  pdf.section("Basic Information");
  pdf.table(
    ["Client", "Date", "Time", "Attendant", "Location"],
    [[
      value(incidentReport, "clientName"),
      value(incidentReport, "incidentDate"),
      value(incidentReport, "incidentTime"),
      value(incidentReport, "attendantName"),
      value(incidentReport, "incidentLocation")
    ]],
    [118, 78, 62, 128, 144]
  );

  pdf.section("Type of Incident");
  pdf.checkboxList(incidentTypes.selected);
  pdf.fullBox("Other", incidentTypes.otherText, 32);

  pdf.section("Description of Incident");
  pdf.fullBox("Description", value(incidentReport, "incidentDescription"), 54);

  pdf.section("Action Taken");
  pdf.checkboxList(actions.selected);
  pdf.fullBox("Other actions", actions.otherText, 32);

  pdf.section("Client Condition After Incident");
  pdf.table(["Condition"], [[value(incidentReport, "clientConditionAfter")]], [530]);
  pdf.fullBox("Notes", value(incidentReport, "conditionNotes"), 40);

  pdf.section("Notifications");
  pdf.checkboxList(notifications.selected);
  if (value(incidentReport, "timeNotified") || value(incidentReport, "personNotified")) {
    pdf.table(
      ["Time Notified", "Person Notified"],
      [[value(incidentReport, "timeNotified"), value(incidentReport, "personNotified")]],
      [160, 370]
    );
  }

  pdf.section("Additional Notes");
  pdf.fullBox("Additional Notes", value(incidentReport, "additionalNotes"), 44);

  pdf.section("Signature");
  pdf.table(
    ["Attendant Name", "Signature", "Date"],
    [[
      value(incidentReport, "signatureAttendantName"),
      value(incidentReport, "attendantSignature"),
      value(incidentReport, "signatureDate")
    ]],
    [180, 230, 120]
  );

  if (value(incidentReport, "supervisorReviewName") || value(incidentReport, "supervisorSignature") || value(incidentReport, "reviewDate")) {
    pdf.table(
      ["Supervisor Review Name", "Supervisor Signature", "Review Date"],
      [[
        value(incidentReport, "supervisorReviewName"),
        value(incidentReport, "supervisorSignature"),
        value(incidentReport, "reviewDate")
      ]],
      [180, 230, 120]
    );
  }

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

function createClientIncidentReportPdf(incidentReport) {
  return buildPdfBuffer(buildPdfPages(incidentReport));
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

function buildEmailHtml(incidentReport, submittedAtDisplay) {
  return `
    <p>New CRS incident report submitted.</p>
    <p><strong>Client:</strong> ${escapeHtml(incidentReport.clientName)}</p>
    <p><strong>Date of Incident:</strong> ${escapeHtml(incidentReport.incidentDate)}</p>
    <p><strong>Time of Incident:</strong> ${escapeHtml(incidentReport.incidentTime)}</p>
    <p><strong>Attendant:</strong> ${escapeHtml(incidentReport.attendantName)}</p>
    <p><strong>Condition After Incident:</strong> ${escapeHtml(incidentReport.clientConditionAfter)}</p>
    <p><strong>Submitted:</strong> ${escapeHtml(submittedAtDisplay)}</p>
  `;
}

async function sendEmail({ incidentReport, submittedAtDisplay, pdfBuffer }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY environment variable.");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "info@communityregenerativesolutions.com",
    subject: `New CRS Incident Report - ${normalizeText(incidentReport.clientName) || "Client"}`,
    html: buildEmailHtml(incidentReport, submittedAtDisplay),
    attachments: [
      {
        filename: pdfFileName(incidentReport),
        content: pdfBuffer
      }
    ]
  });

  if (error) {
    console.error("Resend incident report email failed:", error);
    throw new Error(`Resend email failed: ${error.message || JSON.stringify(error)}`);
  }

  console.info("Resend incident report email sent:", data);
  return data;
}

module.exports = async function handler(req, res) {
  console.info("CRS route started: /api/submit-client-incident-report", { method: req.method });
  console.info("CRS route /api/submit-client-incident-report: supabase helper loaded", {
    storeSupabaseSubmission: typeof storeSupabaseSubmission === "function"
  });
  console.info("CRS route /api/submit-client-incident-report: env vars present", {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY)
  });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const incidentReport = body.incidentReport || body || {};
    const dateSubmitted = body.submittedAt || new Date().toISOString();
    const submittedAtDisplay = body.submittedAtDisplay || new Date().toLocaleString();
    const pdfBuffer = createClientIncidentReportPdf(incidentReport);
    const generatedPdfFileName = pdfFileName(incidentReport);
    const emailResult = await sendEmail({ incidentReport, submittedAtDisplay, pdfBuffer });
    const supabaseSubmission = await storeSupabaseSubmission({
      fullName: normalizeText(incidentReport.clientName),
      email: "",
      submissionType: "client-incident-report",
      pdfBuffer,
      pdfFileName: generatedPdfFileName,
      createdAt: dateSubmitted
    });
    const storedSubmission = await storeSubmission({
      fullName: normalizeText(incidentReport.clientName),
      email: "",
      submissionType: "client-incident-report",
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
    console.error("CRS incident report submission failed:", error);
    return res.status(500).json({
      error: error.message || "Incident report submission failed."
    });
  }
};
