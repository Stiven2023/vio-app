export type LeaveFormErrors = {
  startDate?: string;
  endDate?: string;
};

export type PetitionFormErrors = {
  subject?: string;
  description?: string;
  requestDate?: string;
};

export function validateLeaveForm(startDate: string, endDate: string): {
  errors: LeaveFormErrors;
  firstInvalidFieldId?: "leave-start-date" | "leave-end-date";
} {
  if (!startDate || !endDate) {
    return {
      errors: {
        startDate: !startDate ? "Start date is required." : undefined,
        endDate: !endDate ? "End date is required." : undefined,
      },
      firstInvalidFieldId: !startDate ? "leave-start-date" : "leave-end-date",
    };
  }

  if (startDate > endDate) {
    return {
      errors: { endDate: "End date cannot be before start date." },
      firstInvalidFieldId: "leave-end-date",
    };
  }

  return { errors: {} };
}

export function validatePetitionForm(input: {
  subject: string;
  description: string;
  type: string;
  requestDate: string;
}): {
  errors: PetitionFormErrors;
  firstInvalidFieldId?:
    | "petition-subject"
    | "petition-description"
    | "petition-request-date";
} {
  if (!input.subject.trim()) {
    return {
      errors: { subject: "Subject is required." },
      firstInvalidFieldId: "petition-subject",
    };
  }

  if (!input.description.trim()) {
    return {
      errors: { description: "Description is required." },
      firstInvalidFieldId: "petition-description",
    };
  }

  if (input.type === "PERMISO" && !input.requestDate) {
    return {
      errors: { requestDate: "Request date is required for leave requests." },
      firstInvalidFieldId: "petition-request-date",
    };
  }

  return { errors: {} };
}
