const legacyHcmPathMap: Record<string, string> = {
  bonos: "bonuses",
  bonuses: "bonuses",
  comisiones: "commissions",
  commissions: "commissions",
  incumplimiento: "non-compliance",
  "non-compliance": "non-compliance",
  overtime: "overtime",
  "trabajo-extra": "overtime",
  vacaciones: "vacations",
  vacations: "vacations",
  liquidacion: "settlement",
  settlement: "settlement",
  viaticos: "per-diem",
  "per-diem": "per-diem",
  "permisos-ausencias": "leaves-and-absences",
  "leaves-and-absences": "leaves-and-absences",
  "provisiones-nomina": "payroll-provisions",
  "payroll-provisions": "payroll-provisions",
  pila: "social-security-pila",
  "social-security-pila": "social-security-pila",
};

export function resolveLegacyHcmPath(slug?: string[]) {
  if (!slug?.length) {
    return "/hcm";
  }

  const joinedPath = slug.join("/");
  const targetPath = legacyHcmPathMap[joinedPath];

  return targetPath ? `/hcm/${targetPath}` : "/hcm";
}