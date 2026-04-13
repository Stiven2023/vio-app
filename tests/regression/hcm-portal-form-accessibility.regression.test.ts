import assert from "node:assert/strict";
import test from "node:test";

import {
  validateLeaveForm,
  validatePetitionForm,
} from "@/app/hcm/_components/employee-portal/form-accessibility";

test("hcm portal a11y: leave form returns first invalid start date", () => {
  const result = validateLeaveForm("", "2026-04-08");

  assert.equal(result.firstInvalidFieldId, "leave-start-date");
  assert.equal(result.errors.startDate, "Start date is required.");
});

test("hcm portal a11y: leave form flags invalid end range", () => {
  const result = validateLeaveForm("2026-04-10", "2026-04-09");

  assert.equal(result.firstInvalidFieldId, "leave-end-date");
  assert.equal(result.errors.endDate, "End date cannot be before start date.");
});

test("hcm portal a11y: petition form points to subject first", () => {
  const result = validatePetitionForm({
    subject: "",
    description: "Some text",
    type: "SOLICITUD",
    requestDate: "",
  });

  assert.equal(result.firstInvalidFieldId, "petition-subject");
  assert.equal(result.errors.subject, "Subject is required.");
});

test("hcm portal a11y: petition leave request requires date", () => {
  const result = validatePetitionForm({
    subject: "Need permission",
    description: "Medical appointment",
    type: "PERMISO",
    requestDate: "",
  });

  assert.equal(result.firstInvalidFieldId, "petition-request-date");
  assert.equal(
    result.errors.requestDate,
    "Request date is required for leave requests.",
  );
});
