const { Resend } = require("resend");
const { storeSubmission } = require("../submission-store");
const { storeSupabaseSubmission } = require("../supabase");

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

function safeName(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_|_$/g, "") || "Client";
}

function pdfFileName(fileChecklist) {
  return `${safeName(fileChecklist.fullName || fileChecklist.clientName)}_Client_File_Checklist.pdf`;
}

function createPdf(fileChecklist) {
  const fullName = normalizeText(fileChecklist.fullName || fileChecklist.clientName);
  const completedItems = Object.keys(fileChecklist)
    .filter((key) => fileChecklist[key] === true || normalizeText(fileChecklist[key]) === "on")
    .map((key) => key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()));

  const lines = [
    "BT /F2 18 Tf 132 748 Td (Community Regenerative Solutions) Tj ET",
    "BT /F2 15 Tf 205 724 Td (Client File Checklist) Tj ET",
    "0 G 1 w 42 710 m 570 710 l S",
    `BT /F2 10 Tf 42 682 Td (Client Name) Tj ET`,
    `BT /F1 10 Tf 130 682 Td (${escapePdfText(fullName)}) Tj ET`,
    "0 g 42 650 528 18 re f",
    "1 g BT /F2 10 Tf 49 655 Td (COMPLETED ITEMS) Tj ET"
  ];

  let y = 626;
  const sourceItems = completedItems.length ? completedItems : ["No checklist items were included in the submission."];
  sourceItems.slice(0, 40).forEach((item) => {
    lines.push(`0 g BT /F1 9 Tf 45 ${y} Td ([X] ${escapePdfText(item)}) Tj ET`);
    y -= 14;
  });

  const content = lines.join("\n");
  const objects = [];
  const addObject = (body) => { objects.push(body); return objects.length; };
  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

async function sendEmail({ fileChecklist, submittedAtDisplay, pdfBuffer }) {
  if (!process.env.RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY environment variable.");

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "info@communityregenerativesolutions.com",
    subject: `New CRS Client File Checklist - ${normalizeText(fileChecklist.fullName || fileChecklist.clientName) || "Client"}`,
    html: `
      <p>New CRS client file checklist submitted.</p>
      <p><strong>Client:</strong> ${escapeHtml(fileChecklist.fullName || fileChecklist.clientName)}</p>
      <p><strong>Submitted:</strong> ${escapeHtml(submittedAtDisplay)}</p>
    `,
    attachments: [{ filename: pdfFileName(fileChecklist), content: pdfBuffer }]
  });

  if (error) throw new Error(`Resend email failed: ${error.message || JSON.stringify(error)}`);
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const fileChecklist = body.fileChecklist || body || {};
    const dateSubmitted = body.submittedAt || new Date().toISOString();
    const submittedAtDisplay = body.submittedAtDisplay || new Date().toLocaleString();
    const fullName = normalizeText(fileChecklist.fullName || fileChecklist.clientName);
    const pdfBuffer = createPdf(fileChecklist);
    const generatedPdfFileName = pdfFileName(fileChecklist);
    const emailResult = await sendEmail({ fileChecklist, submittedAtDisplay, pdfBuffer });
    const supabaseSubmission = await storeSupabaseSubmission({
      fullName,
      email: "",
      submissionType: "client-file-checklist",
      pdfBuffer,
      pdfFileName: generatedPdfFileName,
      createdAt: dateSubmitted
    });
    const storedSubmission = await storeSubmission({
      fullName,
      email: "",
      submissionType: "client-file-checklist",
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
    console.error("CRS client file checklist submission failed:", error);
    return res.status(500).json({ error: error.message || "Client file checklist submission failed." });
  }
};
