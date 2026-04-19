/*
  Submission settings.
  The application now posts to a Vercel server-side route.
  Add RESEND_API_KEY in Vercel project environment variables for email delivery.
*/
window.CRSApplicationConfig = {
  submissionEmail: "Info@communityregenerativesolutions.com",
  submissionEndpoint: "/api/submit-form"
};
