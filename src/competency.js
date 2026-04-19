const form = document.querySelector("#competencyForm");
const successMessage = document.querySelector("#successMessage");
const errorSummary = document.querySelector("#errorSummary");
const submissionStatus = document.querySelector("#submissionStatus");
const submitButton = form.querySelector(".submit-button");
const evaluationDate = document.querySelector("#evaluationDate");
const certificationDate = document.querySelector("#certificationDate");

const fieldLabels = {
  employeeFullName: "Employee Full Legal Name",
  evaluatorName: "Evaluator / Supervisor Name",
  evaluationDate: "Evaluation Date",
  certifierName: "Evaluator Typed Name",
  certifierSignature: "Evaluator Signature",
  certificationDate: "Certification Date"
};

const competencyGroups = [
  ["Personal Care Assistance", "personalCare"],
  ["Mobility / transfers", "mobilityTransfers"],
  ["Toileting / Incontinence Care", "toiletingCare"],
  ["Meal preparation", "mealPreparation"],
  ["Light housekeeping", "lightHousekeeping"],
  ["Infection Control", "infectionControl"],
  ["Documentation / Reporting", "documentationReporting"],
  ["Professionalism / Communication", "professionalismCommunication"],
  ["Client Safety Awareness", "clientSafety"],
  ["Understanding prohibited tasks", "prohibitedTasks"]
];

const today = new Date().toISOString().slice(0, 10);
evaluationDate.value = today;
certificationDate.value = today;

function clearErrors() {
  errorSummary.hidden = true;
  errorSummary.innerHTML = "";
  form.querySelectorAll(".field-error").forEach((field) => {
    field.classList.remove("field-error");
    field.removeAttribute("aria-invalid");
  });
}

function showStatus(message, type = "info") {
  submissionStatus.textContent = message;
  submissionStatus.className = `submission-status ${type}`;
  submissionStatus.hidden = false;
}

function markInvalidField(field) {
  field.classList.add("field-error");
  field.setAttribute("aria-invalid", "true");
}

function validateForm() {
  clearErrors();
  const messages = [];
  const requiredFields = Array.from(form.querySelectorAll("[required]"));

  requiredFields.forEach((field) => {
    if (!field.value.trim()) {
      messages.push(`${fieldLabels[field.name] || "This field"} is required.`);
      markInvalidField(field);
    }
  });

  competencyGroups.forEach(([label, prefix]) => {
    const competent = form.querySelector(`input[name="${prefix}Competent"]`);
    const needsImprovement = form.querySelector(`input[name="${prefix}NeedsImprovement"]`);

    if (!competent.checked && !needsImprovement.checked) {
      messages.push(`${label} rating is required.`);
      markInvalidField(competent);
      markInvalidField(needsImprovement);
    }

    if (competent.checked && needsImprovement.checked) {
      messages.push(`Select only one rating for ${label}.`);
      markInvalidField(competent);
      markInvalidField(needsImprovement);
    }
  });

  const recommendationCompetent = form.querySelector('input[name="recommendationCompetent"]');
  const recommendationNeedsTraining = form.querySelector('input[name="recommendationNeedsTraining"]');

  if (!recommendationCompetent.checked && !recommendationNeedsTraining.checked) {
    messages.push("Recommendation is required.");
    markInvalidField(recommendationCompetent);
    markInvalidField(recommendationNeedsTraining);
  }

  if (recommendationCompetent.checked && recommendationNeedsTraining.checked) {
    messages.push("Select only one recommendation.");
    markInvalidField(recommendationCompetent);
    markInvalidField(recommendationNeedsTraining);
  }

  return messages;
}

function showErrors(messages) {
  errorSummary.innerHTML = `
    <strong>Please fix the following before submitting:</strong>
    <ul>${messages.map((message) => `<li>${message}</li>`).join("")}</ul>
  `;
  errorSummary.hidden = false;
  errorSummary.focus();
  showStatus("Please complete the required fields before submitting.", "error");
}

function collectSubmission() {
  const formData = new FormData(form);
  const evaluation = Object.fromEntries(formData.entries());

  form.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    evaluation[checkbox.name] = checkbox.checked;
  });

  return {
    formType: "competency",
    submittedAt: new Date().toISOString(),
    submittedAtDisplay: new Date().toLocaleString(),
    data: evaluation
  };
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "Submitting..." : "Submit Competency Evaluation";
}

async function submitCompetencyEvaluation(submission) {
  console.info("CRS competency evaluation: Sending POST request to /api/submit-form.");

  const response = await fetch("/api/submit-form", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(submission)
  });

  if (!response.ok) {
    const responseText = await response.text();
    console.error("CRS competency evaluation: Server failure response:", response.status, responseText);
    throw new Error("Submission failed. The competency evaluation email could not be sent. Please try again.");
  }

  const responseData = await response.json().catch(() => ({}));
  console.info("CRS competency evaluation: Server success response:", response.status, responseData);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  console.info("CRS competency evaluation: Submit started.");
  submissionStatus.hidden = true;

  const messages = validateForm();
  if (messages.length) {
    console.warn("CRS competency evaluation: Validation failed:", messages);
    showErrors(messages);
    return;
  }

  setSubmitting(true);
  showStatus("Submitting competency evaluation...", "info");

  try {
    await submitCompetencyEvaluation(collectSubmission());
    form.hidden = true;
    successMessage.hidden = false;
    successMessage.focus();
  } catch (error) {
    console.error("CRS competency evaluation: JavaScript submission error:", error);
    showErrors([error.message || "Submission failed. Please try again."]);
  } finally {
    setSubmitting(false);
  }
});
