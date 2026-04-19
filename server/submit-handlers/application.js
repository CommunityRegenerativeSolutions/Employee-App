const { Resend } = require("resend");
const { storeSubmission } = require("../submission-store");
const { storeSupabaseSubmission } = require("../supabase");

const PAGE = { width: 612, height: 792, margin: 42 };
const FONT = { body: "F1", bold: "F2" };
const JOB_DESCRIPTION_TEXT = [
  "Overview",
  "The PAS Attendant provides non-skilled, non-technical personal care services to clients in their homes. Services are delivered in accordance with the client's service plan and aim to support independence, safety, and daily functioning.",
  "",
  "Primary Responsibilities",
  "The PAS Attendant may assist with the following tasks as authorized in the service plan:",
  "Personal Care",
  "- Bathing, grooming, and hygiene",
  "- Dressing and undressing",
  "- Toileting and incontinence care",
  "- Mobility assistance and transfers",
  "Daily Living Activities",
  "- Meal preparation and feeding assistance",
  "- Light housekeeping (laundry, dishes, cleaning client areas)",
  "- Shopping and errands (if authorized)",
  "Health-Related Tasks (Non-Skilled)",
  "- Medication reminders (no administration)",
  "- Observing and reporting changes in client condition",
  "Companionship & Support",
  "- Providing companionship and supervision",
  "- Ensuring client safety at all times",
  "",
  "Prohibited Tasks",
  "PAS Attendants may NOT:",
  "- Perform skilled nursing tasks",
  "- Administer medications",
  "- Provide medical diagnoses or treatments",
  "- Handle client finances (unless specifically authorized and documented)",
  "",
  "Minimum Qualifications",
  "- Must be at least 18 years of age",
  "- Must pass required background checks per HHSC regulations",
  "- Ability to read, write, and communicate effectively in English",
  "- Physically capable of performing job duties (lifting, bending, standing)",
  "- Demonstrates reliability, professionalism, and compassion",
  "",
  "Training Requirements",
  "- Completion of agency orientation prior to providing services",
  "- Ongoing in-service training as required by CRS and HHSC",
  "- Review and understanding of client rights, abuse, neglect, and exploitation reporting, infection control procedures, and confidentiality (HIPAA)",
  "",
  "Work Schedule",
  "- Hours vary based on client needs and assigned schedule",
  "- Must maintain punctuality and reliability",
  "- Must notify supervisor of absences or schedule conflicts immediately"
];

const ACKNOWLEDGMENT_SECTIONS = [
  {
    title: "Confidentiality & HIPAA Agreement",
    field: "confidentialityAcknowledged",
    text: "I understand that client information is private and confidential. I agree to protect personal, health, and service-related information and to follow CRS confidentiality and HIPAA expectations."
  },
  {
    title: "Background Check Authorization",
    field: "backgroundCheckAcknowledged",
    text: "I authorize Community Regenerative Solutions to complete required background, registry, and employment-related checks as part of the application and hiring process, to the extent permitted by law."
  },
  {
    title: "Abuse, Neglect, and Exploitation (ANE) Reporting",
    field: "aneAcknowledged",
    text: "I understand that abuse, neglect, and exploitation must be reported according to agency policy and applicable Texas requirements. I agree to follow reporting procedures immediately if concerns arise."
  },
  {
    title: "Client Rights Acknowledgment",
    field: "clientRightsAcknowledged",
    text: "I understand that clients have rights to dignity, respect, privacy, choice, and safe care. I agree to support and protect client rights while providing services."
  },
  {
    title: "At-Will Employment Statement",
    field: "atWillAcknowledged",
    text: "I understand that employment with Community Regenerative Solutions is at will, unless otherwise stated in a written agreement signed by authorized agency leadership."
  },
  {
    title: "Attendance & Reliability Policy",
    field: "attendanceAcknowledged",
    text: "I understand that reliable attendance and timely communication are essential to client safety and service continuity. I agree to follow agency procedures for schedules, absences, and call-offs."
  }
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

function rowHasData(data, prefix, fields) {
  return fields.some((field) => value(data, `${prefix}${field}`));
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

  function pageBreak() {
    addPage();
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
    text("Employment Application", 205, 724, 15, FONT.bold);
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

  function paragraph(textValue) {
    const sourceLines = Array.isArray(textValue) ? textValue : [textValue];
    const lineHeight = 11;
    sourceLines.forEach((sourceLine) => {
      if (!sourceLine) {
        y -= 6;
        return;
      }

      const isHeading = !sourceLine.startsWith("-") && sourceLine.length < 45;
      const x = sourceLine.startsWith("-") ? PAGE.margin + 10 : PAGE.margin;
      const lines = wrapText(sourceLine, isHeading ? 80 : 95);
      ensure(lines.length * lineHeight + 6);
      lines.forEach((lineText) => {
        text(lineText, x, y, 9, isHeading ? FONT.bold : FONT.body);
        y -= lineHeight;
      });
    });
    y -= 8;
  }

  function table(headers, rows, columnWidths) {
    if (!rows.length) return;
    const totalWidth = columnWidths.reduce((sum, item) => sum + item, 0);
    const startX = PAGE.margin;
    const rowHeight = 24;
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

  function employmentBlock(label, data, prefix) {
    const fields = ["Name", "JobTitle", "Supervisor", "Phone", "Address", "StartDate", "EndDate", "Reason", "MayContact"];
    if (prefix !== "employer1" && !rowHasData(data, prefix, fields)) return;

    ensure(150);
    text(label, PAGE.margin, y, 10, FONT.bold);
    y -= 10;
    rect(PAGE.margin, y - 130, PAGE.width - PAGE.margin * 2, 130);
    y -= 14;
    fieldRow([
      ["Employer Name", value(data, `${prefix}Name`)],
      ["Job Title", value(data, `${prefix}JobTitle`)]
    ], 30);
    fieldRow([
      ["Supervisor Name", value(data, `${prefix}Supervisor`)],
      ["Employer Phone Number", value(data, `${prefix}Phone`)]
    ], 30);
    fullField("Employer Address", value(data, `${prefix}Address`), 32);
    fieldRow([
      ["Start Date", value(data, `${prefix}StartDate`)],
      ["End Date", value(data, `${prefix}EndDate`)],
      ["May Contact Employer", value(data, `${prefix}MayContact`)]
    ], 30);
    fullField("Reason for Leaving", value(data, `${prefix}Reason`), 32);
    y -= 8;
  }

  function finish() {
    pages.push(stream);
    return pages;
  }

  return { title, section, fieldRow, fullField, paragraph, table, employmentBlock, pageBreak, finish };
}

function buildPdfPages(data) {
  const pdf = createPdfContext();
  pdf.title();

  pdf.section("Position Information");
  pdf.fieldRow([
    ["Position Applying For", value(data, "position")],
    ["Date Available to Start", value(data, "dateAvailable")]
  ]);
  pdf.fieldRow([
    ["Desired Schedule", value(data, "availability")],
    ["Days Available", value(data, "daysAvailable")],
    ["Preferred Shift(s)", value(data, "preferredShifts")]
  ]);

  pdf.section("Personal Information");
  pdf.fieldRow([
    ["Full Legal Name", value(data, "fullName")],
    ["Phone Number", value(data, "phone")]
  ]);
  pdf.fieldRow([
    ["Email Address", value(data, "email")],
    ["Home Address", value(data, "address")]
  ]);
  pdf.fieldRow([
    ["City", value(data, "city")],
    ["State", value(data, "state")],
    ["ZIP Code", value(data, "zipCode")]
  ]);

  pdf.section("Qualifications / Criminal History");
  pdf.fieldRow([
    ["Authorized to work in the U.S.", value(data, "authorizedToWork")],
    ["Reliable transportation", value(data, "reliableTransportation")]
  ]);
  pdf.fieldRow([
    ["Valid driver's license", value(data, "validDriversLicense")],
    ["Able to assist with personal care tasks", value(data, "personalCareTasks")]
  ]);
  pdf.fieldRow([
    ["Felony conviction", value(data, "felonyConviction")]
  ]);
  if (value(data, "felonyExplanation")) {
    pdf.fullField("Felony explanation", value(data, "felonyExplanation"), 48);
  }

  pdf.section("Education");
  pdf.table(
    ["Highest Level", "School Name", "City/State", "Degree/Certification", "Graduation/Last Date"],
    [[
      value(data, "educationLevel"),
      value(data, "schoolName"),
      value(data, "schoolLocation"),
      value(data, "degreeEarned"),
      value(data, "graduationDate")
    ]],
    [100, 110, 90, 130, 100]
  );

  pdf.section("Employment History");
  pdf.employmentBlock("Previous Employment 1", data, "employer1");
  pdf.employmentBlock("Previous Employment 2", data, "employer2");
  pdf.employmentBlock("Previous Employment 3", data, "employer3");

  pdf.section("References");
  const references = [1, 2, 3].map((index) => [
    value(data, `reference${index}Name`),
    value(data, `reference${index}Relationship`),
    value(data, `reference${index}Phone`),
    value(data, `reference${index}Email`)
  ]).filter((row, index) => index === 0 || row.some(Boolean));
  pdf.table(["Name", "Relationship", "Phone", "Email"], references, [150, 115, 110, 155]);

  pdf.section("Emergency Contact");
  pdf.fieldRow([
    ["Emergency Contact Name", value(data, "emergencyName")],
    ["Relationship", value(data, "emergencyRelationship")]
  ]);
  pdf.fieldRow([
    ["Emergency Contact Phone Number", value(data, "emergencyPhone")]
  ]);

  pdf.section("Acknowledgment and Authorization");
  pdf.table(
    ["Acknowledgment", "Checked"],
    [
      ["Information provided is true and complete to the best of my knowledge.", checked(data.certifyTrueComplete)],
      ["False, misleading, or omitted information may affect employment.", checked(data.falseInfoAcknowledgment)],
      ["CRS may verify employment, education, and references as permitted by law.", checked(data.authorizeVerification)],
      ["Submission of this application does not guarantee employment.", checked(data.noGuaranteeAcknowledgment)]
    ],
    [440, 90]
  );

  pdf.section("Signature");
  pdf.fieldRow([
    ["Applicant Signature", value(data, "signature")],
    ["Date", value(data, "signatureDate")]
  ]);

  pdf.pageBreak();
  pdf.section("Job Description Acknowledgment");
  pdf.paragraph(JOB_DESCRIPTION_TEXT);
  pdf.table(
    ["Acknowledgment", "Checked"],
    [["I have read and understand the duties and responsibilities of the Personal Assistance Services (PAS) Attendant position.", checked(data.jobDescriptionAcknowledged)]],
    [440, 90]
  );

  ACKNOWLEDGMENT_SECTIONS.forEach((section) => {
    pdf.section(section.title);
    pdf.paragraph(section.text);
    pdf.table(
      ["Acknowledgment", "Checked"],
      [["I acknowledge and agree", checked(data[section.field])]],
      [440, 90]
    );
  });

  pdf.section("Final Acknowledgment");
  pdf.paragraph("By signing below, I confirm that I have read, understand, and agree to all sections above, including the employment application, job description, and all acknowledgments.");
  pdf.fieldRow([
    ["Typed Full Name", value(data, "finalAcknowledgmentFullName")],
    ["Signature", value(data, "finalAcknowledgmentSignature")],
    ["Date", value(data, "finalAcknowledgmentDate")]
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

function createEmploymentApplicationPdf(applicationData) {
  return buildPdfBuffer(buildPdfPages(applicationData));
}

function pdfFileName(applicant) {
  const name = normalizeText(applicant.fullName)
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_|_$/g, "");
  return `${name || "Applicant"}_Employment_Application.pdf`;
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

async function sendEmail({ applicant, pdfBuffer }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY environment variable.");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "info@communityregenerativesolutions.com",
    subject: "New CRS Employment Application",
    html: "<p>New application submitted</p>",
    attachments: [
      {
        filename: pdfFileName(applicant),
        content: pdfBuffer
      }
    ]
  });

  if (error) {
    console.error("Resend email failed:", error);
    throw new Error(`Resend email failed: ${error.message || JSON.stringify(error)}`);
  }

  console.info("Resend email sent:", data);
  return data;
}

module.exports = async function handler(req, res) {
  console.info("CRS route started: /api/submit-application", { method: req.method });
  console.info("CRS route /api/submit-application: supabase helper loaded", {
    storeSupabaseSubmission: typeof storeSupabaseSubmission === "function"
  });
  console.info("CRS route /api/submit-application: env vars present", {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY)
  });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const applicant = body.applicant || body || {};
    const dateSubmitted = body.submittedAt || new Date().toISOString();
    const pdfBuffer = createEmploymentApplicationPdf(applicant);
    const emailResult = await sendEmail({ applicant, pdfBuffer });
    const supabaseSubmission = await storeSupabaseSubmission({
      fullName: normalizeText(applicant.fullName),
      email: normalizeText(applicant.email),
      submissionType: "application",
      pdfBuffer,
      createdAt: dateSubmitted
    });
    const storedSubmission = await storeSubmission({
      fullName: normalizeText(applicant.fullName),
      email: normalizeText(applicant.email),
      submissionType: "application",
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
    console.error("CRS application submission failed:", error);
    return res.status(500).json({
      error: error.message || "Application submission failed."
    });
  }
};
