const fs = require("fs/promises");
const os = require("os");
const path = require("path");

/*
  Temporary JSON storage for future admin dashboard work.
  On Vercel, /tmp is writable during a serverless function instance lifetime.
  This is not permanent database storage, but it gives the app a simple shared shape.
*/
const STORE_PATH = path.join(os.tmpdir(), "crs-submissions.json");

async function readSubmissions() {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.submissions) ? parsed.submissions : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function storeSubmission(record) {
  const submissions = await readSubmissions();
  const savedRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    fullName: record.fullName || "",
    email: record.email || "",
    submissionType: record.submissionType,
    pdfFileName: record.pdfFileName,
    pdfUrl: record.pdfUrl || "",
    dateSubmitted: record.dateSubmitted || new Date().toISOString()
  };

  submissions.push(savedRecord);

  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(
    STORE_PATH,
    JSON.stringify({ submissions }, null, 2),
    "utf8"
  );

  return savedRecord;
}

module.exports = {
  STORE_PATH,
  readSubmissions,
  storeSubmission
};
