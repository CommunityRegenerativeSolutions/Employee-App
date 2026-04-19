const { Resend } = require("resend");
const { storeSubmission } = require("../submission-store");
const { storeSupabaseSubmission } = require("../supabase");

const PAGE = { width: 612, height: 792, margin: 32 };
const FONT = { body: "F1", bold: "F2" };
const SERVICE_SECTIONS = [
  ["A", "Personal Hygiene / Bathing", ["Gather bathing supplies", "Assist with entering/leaving tub or shower", "Standby assistance for safety", "Sponge bath", "Bed bath", "Wash hair", "Dry hair", "Oral hygiene", "Grooming", "Shaving", "Nail care", "Apply lotion / skin care", "Dressing after bathing", "Other"]],
  ["B", "Dressing / Personal Care", ["Select clothing", "Upper body dressing", "Lower body dressing", "Undressing", "Apply shoes / socks", "Assist with braces / supports", "Personal appearance / grooming", "Other"]],
  ["C", "Toileting / Continence", ["Toilet transfer assistance", "Standby assistance for toileting", "Assist with clothing during toileting", "Incontinence brief change", "Perineal care / hygiene", "Assist with commode use", "Assist with urinal use", "Empty commode / supplies cleanup", "Catheter bag positioning / non-skilled observation only", "Handwashing after toileting", "Other"]],
  ["D", "Mobility / Transfers", ["Bed mobility", "Transfer bed to chair", "Transfer chair to toilet", "Repositioning", "Walking assistance", "Wheelchair assistance", "Standby for fall prevention", "Other"]],
  ["E", "Nutrition / Meal Support", ["Meal planning", "Meal preparation", "Feeding assistance", "Set up meal tray", "Encourage fluids", "Clean eating area", "Observe appetite / intake", "Other"]],
  ["F", "Housekeeping / Home Support", ["Laundry", "Dishes", "Trash removal", "Clean bathroom used by client", "Clean bedroom / client area", "Change linens", "Organize supplies", "Other"]],
  ["G", "Supervision / Safety Monitoring", ["Cueing / reminders", "Redirection", "Monitoring for confusion", "Supervision for safety", "Observe changes in condition", "Report concerns to supervisor", "Other"]]
];
const RISK_FIELDS = [["Fall Risk", "riskFall"], ["Cognitive Impairment", "riskCognitive"], ["Transfer Assistance Needed", "riskTransfer"], ["Supervision Needed", "riskSupervision"], ["Other", "riskOther"]];

function normalizeText(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return String(value || "").normalize("NFKD").replace(/[^\x20-\x7E]/g, "").trim();
}
function escapePdfText(value) {
  return normalizeText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\r?\n/g, " ");
}
function escapeHtml(value) {
  return normalizeText(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function wrapText(value, maxChars) {
  const words = normalizeText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) { lines.push(line); line = word; return; }
    line = next;
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
function value(data, key) { return normalizeText(data[key]); }
function selectedList(data, fields) {
  return fields.filter(([, key]) => data[key] === true || value(data, key) === "on").map(([label]) => label).join(", ");
}
function fieldName(sectionCode, rowIndex, suffix) { return `section${sectionCode}Row${rowIndex}${suffix}`; }
function pdfFileName(plan) {
  const safeName = value(plan, "clientName").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  return `${safeName || "Client"}_Client_Service_Plan.pdf`;
}

function createPdfContext() {
  const pages = [];
  let stream = [];
  let y = 734;
  function push(command) { stream.push(command); }
  function addPage() { pages.push(stream); stream = []; y = 734; }
  function ensure(spaceNeeded) { if (y - spaceNeeded < PAGE.margin) addPage(); }
  function text(textValue, x, yPos, size = 8, font = FONT.body, color = 0) {
    push(`${color} g BT /${font} ${size} Tf ${x} ${yPos} Td (${escapePdfText(textValue)}) Tj ET`);
  }
  function line(x1, y1, x2, y2, width = 0.6) { push(`0 G ${width} w ${x1} ${y1} m ${x2} ${y2} l S`); }
  function rect(x, yPos, width, height) { push(`0 G 0.6 w ${x} ${yPos} ${width} ${height} re S`); }
  function fillRect(x, yPos, width, height) { push(`0 g ${x} ${yPos} ${width} ${height} re f`); }
  function title() {
    text("Community Regenerative Solutions", 132, 758, 17, FONT.bold);
    text("Client Service Plan (CRS-CL03)", 198, 737, 13, FONT.bold);
    text("Private-Pay Personal Assistance Services Plan", 178, 720, 9, FONT.bold);
    line(PAGE.margin, 710, PAGE.width - PAGE.margin, 710, 1);
    y = 694;
  }
  function section(titleText) {
    ensure(28);
    fillRect(PAGE.margin, y - 3, PAGE.width - PAGE.margin * 2, 16);
    text(titleText.toUpperCase(), PAGE.margin + 6, y + 1, 8.5, FONT.bold, 1);
    y -= 23;
  }
  function kvTable(rows, widths = [140, 150, 120, 138]) {
    const rowHeight = 22;
    ensure(rowHeight * Math.ceil(rows.length / 2) + 6);
    for (let i = 0; i < rows.length; i += 2) {
      const pair = [rows[i], rows[i + 1]].filter(Boolean);
      let x = PAGE.margin;
      rect(PAGE.margin, y - rowHeight, PAGE.width - PAGE.margin * 2, rowHeight);
      pair.forEach(([label, val], index) => {
        const labelWidth = widths[index * 2];
        const valueWidth = widths[index * 2 + 1];
        if (index > 0) line(x, y, x, y - rowHeight);
        text(label, x + 4, y - 9, 7, FONT.bold);
        line(x + labelWidth, y, x + labelWidth, y - rowHeight);
        wrapText(val, Math.floor((valueWidth - 8) / 4.5)).slice(0, 2).forEach((part, lineIndex) => text(part, x + labelWidth + 4, y - 9 - lineIndex * 8, 7));
        x += labelWidth + valueWidth;
      });
      y -= rowHeight;
    }
    y -= 8;
  }
  function fullBox(label, val, height = 34) {
    if (!value({ val }, "val")) return;
    ensure(height + 4);
    rect(PAGE.margin, y - height, PAGE.width - PAGE.margin * 2, height);
    text(label, PAGE.margin + 4, y - 10, 7, FONT.bold);
    wrapText(val, 108).slice(0, 3).forEach((part, index) => text(part, PAGE.margin + 4, y - 21 - index * 8, 7));
    y -= height + 8;
  }
  function serviceTable(titleText, rows, sectionCode, plan) {
    section(titleText);
    const widths = [190, 78, 108, 172];
    const headers = ["Activity", "Frequency", "Level of Assistance", "Notes / Instructions"];
    const rowHeight = 22;
    const drawHeader = () => {
      ensure(rowHeight * 2);
      let x = PAGE.margin;
      rect(PAGE.margin, y - rowHeight, PAGE.width - PAGE.margin * 2, rowHeight);
      headers.forEach((header, index) => {
        if (index > 0) line(x, y, x, y - rowHeight);
        text(header, x + 3, y - 13, 7, FONT.bold);
        x += widths[index];
      });
      y -= rowHeight;
    };
    drawHeader();
    rows.forEach((activity, index) => {
      if (y - rowHeight < PAGE.margin) { addPage(); drawHeader(); }
      const values = [
        activity,
        value(plan, fieldName(sectionCode, index, "Frequency")),
        value(plan, fieldName(sectionCode, index, "Assistance")),
        value(plan, fieldName(sectionCode, index, "Notes"))
      ];
      let x = PAGE.margin;
      rect(PAGE.margin, y - rowHeight, PAGE.width - PAGE.margin * 2, rowHeight);
      values.forEach((cell, cellIndex) => {
        if (cellIndex > 0) line(x, y, x, y - rowHeight);
        wrapText(cell, Math.floor((widths[cellIndex] - 6) / 4.4)).slice(0, 2).forEach((part, lineIndex) => text(part, x + 3, y - 9 - lineIndex * 8, 6.7, cellIndex === 0 ? FONT.bold : FONT.body));
        x += widths[cellIndex];
      });
      y -= rowHeight;
    });
    const summary = value(plan, `section${sectionCode}Summary`);
    if (summary) {
      const summaryHeight = 30;
      if (y - summaryHeight < PAGE.margin) addPage();
      rect(PAGE.margin, y - summaryHeight, PAGE.width - PAGE.margin * 2, summaryHeight);
      text("Section summary / attendant instructions", PAGE.margin + 3, y - 9, 7, FONT.bold);
      wrapText(summary, 110).slice(0, 2).forEach((part, lineIndex) => text(part, PAGE.margin + 3, y - 19 - lineIndex * 8, 6.7));
      y -= summaryHeight;
    }
    y -= 8;
  }
  function paragraph(textValue) {
    const lines = wrapText(textValue, 110);
    ensure(lines.length * 10 + 6);
    lines.forEach((lineText) => { text(lineText, PAGE.margin, y, 8); y -= 10; });
    y -= 6;
  }
  function finish() { pages.push(stream); return pages; }
  return { title, section, kvTable, fullBox, serviceTable, paragraph, finish };
}

function buildPdfPages(plan) {
  const pdf = createPdfContext();
  pdf.title();
  pdf.section("Header Section");
  pdf.kvTable([
    ["Client Name", value(plan, "clientName")], ["Date of Birth", value(plan, "dateOfBirth")],
    ["Start / Effective Date", value(plan, "effectiveDate")], ["Review Date", value(plan, "reviewDate")],
    ["Prepared By / Assessor", value(plan, "preparedBy")], ["Phone Number", value(plan, "phoneNumber")],
    ["Responsible Party / Guardian", value(plan, "responsibleParty")], ["Emergency Contact", value(plan, "emergencyContact")],
    ["Emergency Contact Phone", value(plan, "emergencyPhone")]
  ]);
  pdf.fullBox("Service Address", value(plan, "serviceAddress"));
  pdf.section("Plan Summary");
  pdf.kvTable([["Overall level of assistance", value(plan, "assistanceLevel")], ["Primary risks", selectedList(plan, RISK_FIELDS)]]);
  pdf.fullBox("Notes / special concerns", value(plan, "summaryNotes"), 42);
  SERVICE_SECTIONS.forEach(([code, titleText, rows]) => pdf.serviceTable(`${code}. ${titleText}`, rows, code, plan));
  pdf.section("Special Instructions");
  pdf.fullBox("Transfer precautions", value(plan, "transferPrecautions"));
  pdf.fullBox("Fall prevention instructions", value(plan, "fallPrevention"));
  pdf.fullBox("Cognitive / behavior notes", value(plan, "cognitiveNotes"));
  pdf.fullBox("Home environment concerns", value(plan, "homeConcerns"));
  pdf.fullBox("Preferred routines / care preferences", value(plan, "preferredRoutines"));
  pdf.fullBox("Tasks declined or not authorized", value(plan, "declinedTasks"));
  pdf.section("Non-Skilled Scope Notice");
  pdf.paragraph("Community Regenerative Solutions provides non-skilled personal assistance services only. Staff may assist with authorized personal care and household support tasks but do not provide skilled nursing services, medical treatment, or medication administration.");
  pdf.section("Approval / Signature");
  pdf.kvTable([
    ["Client / Responsible Party Name", value(plan, "clientSignerName")], ["Client / Responsible Party Signature", value(plan, "clientSignature")],
    ["Date", value(plan, "clientSignatureDate")], ["Agency Representative Name", value(plan, "agencyRepName")],
    ["Agency Representative Signature", value(plan, "agencyRepSignature")], ["Date", value(plan, "agencyRepDate")]
  ]);
  return pdf.finish();
}

function buildPdfBuffer(pageStreams) {
  const objects = [];
  const addObject = (body) => { objects.push(body); return objects.length; };
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
  objects.forEach((body, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${body}\nendobj\n`; });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}
function createClientServicePlanPdf(plan) { return buildPdfBuffer(buildPdfPages(plan)); }
async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString("utf8");
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(rawBody));
  return JSON.parse(rawBody || "{}");
}
function buildEmailHtml(plan, submittedAtDisplay) {
  return `<p>New CRS client service plan submitted.</p><p><strong>Client:</strong> ${escapeHtml(plan.clientName)}</p><p><strong>Effective Date:</strong> ${escapeHtml(plan.effectiveDate)}</p><p><strong>Submitted:</strong> ${escapeHtml(submittedAtDisplay)}</p>`;
}
async function sendEmail({ plan, submittedAtDisplay, pdfBuffer }) {
  if (!process.env.RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY environment variable.");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "info@communityregenerativesolutions.com",
    subject: `New CRS Client Service Plan - ${normalizeText(plan.clientName) || "Client"}`,
    html: buildEmailHtml(plan, submittedAtDisplay),
    attachments: [{ filename: pdfFileName(plan), content: pdfBuffer }]
  });
  if (error) throw new Error(`Resend email failed: ${error.message || JSON.stringify(error)}`);
  return data;
}

module.exports = async function handler(req, res) {
  console.info("CRS route started: /api/submit-client-service-plan", { method: req.method });
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const body = await readJsonBody(req);
    const plan = body.servicePlan || body || {};
    const dateSubmitted = body.submittedAt || new Date().toISOString();
    const submittedAtDisplay = body.submittedAtDisplay || new Date().toLocaleString();
    const pdfBuffer = createClientServicePlanPdf(plan);
    const emailResult = await sendEmail({ plan, submittedAtDisplay, pdfBuffer });
    const supabaseSubmission = await storeSupabaseSubmission({
      fullName: normalizeText(plan.clientName),
      email: "",
      submissionType: "client-service-plan",
      pdfBuffer,
      createdAt: dateSubmitted
    });
    const storedSubmission = await storeSubmission({
      fullName: normalizeText(plan.clientName),
      email: "",
      submissionType: "client-service-plan",
      pdfFileName: supabaseSubmission.pdfFileName,
      pdfUrl: supabaseSubmission.pdfUrl,
      dateSubmitted
    });
    return res.status(200).json({ ok: true, emailId: emailResult?.id, submissionId: supabaseSubmission.id || storedSubmission.id, pdfUrl: supabaseSubmission.pdfUrl });
  } catch (error) {
    console.error("CRS client service plan submission failed:", error);
    return res.status(500).json({ error: error.message || "Client service plan submission failed." });
  }
};
