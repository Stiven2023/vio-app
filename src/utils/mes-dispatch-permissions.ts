type DispatchApprovalStepInput = {
  approved?: boolean;
  approverName?: string | null;
  approvedAt?: string | null;
  notes?: string | null;
};

type DispatchApprovalsInput = {
  seller?: DispatchApprovalStepInput | null;
  cartera?: DispatchApprovalStepInput | null;
  accounting?: DispatchApprovalStepInput | null;
  partial?: DispatchApprovalStepInput | null;
} | null;

function normalizeRole(role: string | null | undefined) {
  return String(role ?? "").trim().toUpperCase();
}

export function isDispatchAdminRole(role: string | null | undefined) {
  return normalizeRole(role) === "ADMINISTRADOR";
}

export function isDispatchLeaderRole(role: string | null | undefined) {
  const normalized = normalizeRole(role);

  return normalized === "LIDER" || normalized.startsWith("LIDER_");
}

export function isDispatchOperarioRole(role: string | null | undefined) {
  return normalizeRole(role) === "OPERARIO_DESPACHO";
}

export function canCreateDispatchShipment(role: string | null | undefined) {
  return (
    isDispatchAdminRole(role) ||
    isDispatchLeaderRole(role) ||
    isDispatchOperarioRole(role)
  );
}

export function canUpdateDispatchShipment(role: string | null | undefined) {
  return canCreateDispatchShipment(role);
}

export function canApproveDispatchShipment(role: string | null | undefined) {
  return isDispatchAdminRole(role) || isDispatchLeaderRole(role);
}

export function canCancelDispatchShipment(role: string | null | undefined) {
  return isDispatchAdminRole(role);
}

export function hasFinalDispatchApprovalInput(
  approvals: DispatchApprovalsInput | undefined,
) {
  if (!approvals) {
    return false;
  }

  const steps = [
    approvals.seller,
    approvals.cartera,
    approvals.accounting,
    approvals.partial,
  ];

  return steps.some((step) => {
    if (!step) return false;

    if (step.approved) return true;
    if (String(step.approverName ?? "").trim()) return true;
    if (String(step.approvedAt ?? "").trim()) return true;

    return String(step.notes ?? "").trim().length > 0;
  });
}

export function getMesDispatchCapabilities(role: string | null | undefined) {
  return {
    canCreate: canCreateDispatchShipment(role),
    canUpdate: canUpdateDispatchShipment(role),
    canApprove: canApproveDispatchShipment(role),
    canCancel: canCancelDispatchShipment(role),
  };
}
