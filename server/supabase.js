const { createClient } = require("@supabase/supabase-js");

const BUCKET_NAME = "employee-files";
const TABLE_NAME = "submissions";

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  console.info("CRS Supabase: env vars present", {
    SUPABASE_URL: Boolean(supabaseUrl),
    SUPABASE_ANON_KEY: Boolean(supabaseKey)
  });

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variable.");
  }

  return createClient(supabaseUrl, supabaseKey);
}

function normalizeName(value) {
  return String(value || "Employee")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

function safeName(value) {
  return normalizeName(value)
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_|_$/g, "") || "Employee";
}

function createStorageFileName(fullName, submissionType) {
  if (submissionType === "client-intake") {
    return `${safeName(fullName)}_Client_Intake.pdf`;
  }

  if (submissionType === "client-assessment") {
    return `${safeName(fullName)}_Client_Assessment.pdf`;
  }

  if (submissionType === "client-service-plan") {
    return `${safeName(fullName)}_Client_Service_Plan.pdf`;
  }

  return `${safeName(fullName)}_${submissionType}.pdf`;
}

async function uploadSubmissionPdf({ fullName, submissionType, pdfBuffer, pdfFileName: requestedPdfFileName }) {
  const supabase = getSupabaseClient();
  const pdfFileName = requestedPdfFileName || createStorageFileName(fullName, submissionType);
  const storagePath = pdfFileName;

  console.info("CRS Supabase: pdf upload starting", {
    bucket: BUCKET_NAME,
    storagePath,
    pdfFileName,
    submissionType,
    pdfBytes: pdfBuffer?.length || 0
  });

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true
    });

  if (uploadError) {
    console.error("CRS Supabase: exact upload error", {
      message: uploadError.message,
      name: uploadError.name,
      statusCode: uploadError.statusCode,
      error: uploadError
    });
    throw new Error(`Supabase PDF upload failed: ${uploadError.message}`);
  }

  console.info("CRS Supabase: pdf upload success", {
    bucket: BUCKET_NAME,
    storagePath
  });

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);

  if (!data?.publicUrl) {
    throw new Error("Supabase PDF upload succeeded, but no public URL was returned.");
  }

  return {
    pdfFileName,
    pdfUrl: data.publicUrl
  };
}

async function insertSubmissionRecord({ fullName, email, submissionType, pdfUrl, createdAt }) {
  const supabase = getSupabaseClient();
  const insertPayload = {
    full_name: fullName || "",
    email: email || "",
    submission_type: submissionType,
    pdf_url: pdfUrl,
    created_at: createdAt || new Date().toISOString()
  };

  console.info("CRS Supabase: db insert starting", {
    table: TABLE_NAME
  });
  console.info("CRS Supabase: exact insert payload", insertPayload);

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("CRS Supabase: exact insert error", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      error
    });
    throw new Error(`Supabase submission insert failed: ${error.message}`);
  }

  console.info("CRS Supabase: db insert success", data);
  return data;
}

async function storeSupabaseSubmission({ fullName, email, submissionType, pdfBuffer, createdAt, pdfFileName }) {
  console.info("CRS Supabase: helper loaded and store started", {
    submissionType,
    fullName,
    hasEmail: Boolean(email)
  });

  const uploadedPdf = await uploadSubmissionPdf({
    fullName,
    submissionType,
    pdfBuffer,
    pdfFileName
  });

  const submission = await insertSubmissionRecord({
    fullName,
    email,
    submissionType,
    pdfUrl: uploadedPdf.pdfUrl,
    createdAt
  });

  return {
    ...submission,
    pdfFileName: uploadedPdf.pdfFileName,
    pdfUrl: uploadedPdf.pdfUrl
  };
}

async function readSupabaseSubmissions() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("id, full_name, email, submission_type, pdf_url, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Supabase submissions lookup failed: ${error.message}`);
  }

  return (data || []).map((record) => ({
    id: record.id,
    fullName: record.full_name || "",
    email: record.email || "",
    submissionType: record.submission_type,
    pdfUrl: record.pdf_url || "",
    dateSubmitted: record.created_at
  }));
}

module.exports = {
  createStorageFileName,
  readSupabaseSubmissions,
  storeSupabaseSubmission
};
