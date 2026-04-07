import type { fabrics } from "../schema";

export type FabricSeed = Omit<
  typeof fabrics.$inferInsert,
  "id" | "createdAt" | "updatedAt"
>;

export const fabricsSeed: FabricSeed[] = [
  { name: "POLIESTER", category: "POLIESTER", isActive: true },
  { name: "POLIESTER MATE", category: "POLIESTER", isActive: true },
  { name: "POLIESTER BRILLANTE", category: "POLIESTER", isActive: true },
  { name: "MICRO POLIESTER", category: "POLIESTER", isActive: true },
  { name: "LICRA", category: "LICRA", isActive: true },
  { name: "LICRA GRUESA", category: "LICRA", isActive: true },
  { name: "LICRA DELGADA", category: "LICRA", isActive: true },
  { name: "SUPLEX", category: "LICRA", isActive: true },
  { name: "MALLA", category: "MALLA", isActive: true },
  { name: "MALLA DEPORTIVA", category: "MALLA", isActive: true },
  { name: "DRY FIT", category: "POLIESTER", isActive: true },
  { name: "POWER DRY", category: "POLIESTER", isActive: true },
  { name: "ALGODON", category: "ALGODON", isActive: true },
  { name: "ALGODON PEINADO", category: "ALGODON", isActive: true },
  { name: "INTERLOCK", category: "OTRA", isActive: true },
  { name: "PUNTO", category: "OTRA", isActive: true },
  { name: "SPRING", category: "OTRA", isActive: true },
  { name: "TAFETA", category: "OTRA", isActive: true },
  { name: "RIB", category: "OTRA", isActive: true },
  { name: "FLEECE", category: "OTRA", isActive: true },
  { name: "FRENCH TERRY", category: "OTRA", isActive: true },
  { name: "NYLON", category: "OTRA", isActive: true },
  { name: "NEOPRENO", category: "OTRA", isActive: true },
];

export const moldingFabricCompatibilitySeed: Array<{
  moldingCode: string;
  fabricNames: string[];
}> = [
  { moldingCode: "D.N-CLL-001", fabricNames: ["POLIESTER", "DRY FIT", "MALLA"] },
  { moldingCode: "D.N-CLL-002", fabricNames: ["POLIESTER", "SUPLEX", "MALLA"] },
  { moldingCode: "D.N-CLL-003", fabricNames: ["POLIESTER", "MALLA DEPORTIVA"] },
  { moldingCode: "D.N-LCR-004", fabricNames: ["LICRA", "SUPLEX"] },
  { moldingCode: "D.N-CTA-005", fabricNames: ["POLIESTER", "DRY FIT", "ALGODON"] },
  { moldingCode: "D.N-CTA/CAP-006", fabricNames: ["POLIESTER", "FRENCH TERRY", "FLEECE"] },
  { moldingCode: "D.N-PTA-007", fabricNames: ["POLIESTER", "DRY FIT", "SUPLEX"] },
  { moldingCode: "D.N-PTA4-008", fabricNames: ["POLIESTER", "SUPLEX", "MALLA"] },
];
