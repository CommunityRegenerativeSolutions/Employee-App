const { readSubmissions } = require("./submission-store");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const submissions = await readSubmissions();

    return res.status(200).json({
      ok: true,
      submissions
    });
  } catch (error) {
    console.error("CRS submissions lookup failed:", error);
    return res.status(500).json({
      error: "Submissions could not be loaded."
    });
  }
};
