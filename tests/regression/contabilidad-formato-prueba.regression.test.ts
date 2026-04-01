import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAccountingQaTemplateCsv,
  buildAccountingQaTemplateFilename,
} from "@/src/utils/accounting-test-format";

test("contabilidad formato QA: genera encabezados esperados", () => {
  const csv = buildAccountingQaTemplateCsv();
  const [header] = csv.split("\n");

  assert.equal(
    header,
    "caseId;module;flow;priority;risk;preconditions;steps;expectedResult;actualResult;status;evidence;executedBy;executedAt;observations",
  );
});

test("contabilidad formato QA: incluye casos base de SIIGO", () => {
  const csv = buildAccountingQaTemplateCsv();

  assert.equal(csv.includes("SIIGO-F-01"), true);
  assert.equal(csv.includes("SIIGO-R-01"), true);
  assert.equal(csv.includes("SIIGO-ADM-01"), true);
});

test("contabilidad formato QA: nombre de archivo con fecha", () => {
  const filename = buildAccountingQaTemplateFilename(
    new Date(Date.UTC(2026, 3, 1)),
  );

  assert.equal(filename, "contabilidad-qa-template-2026-04-01.csv");
});