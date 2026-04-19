const { readSubmissions } = require("./submission-store");
const { readSupabaseSubmissions } = require("./supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let submissions;
    let source = "supabase";

    try {
      submissions = await readSupabaseSubmissions();
    } catch (supabaseError) {
      console.error("CRS Supabase submissions lookup failed, using JSON fallback:", supabaseError);
      submissions = await readSubmissions();
      source = "temporary-json";
    }

    return res.status(200).json({
      ok: true,
      source,
      submissions
    });
  } catch (error) {
    console.error("CRS submissions lookup failed:", error);
    return res.status(500).json({
      error: "Submissions could not be loaded."
    });
  }
};
