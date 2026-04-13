"use client";

import { FormEvent, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";

type LetterType =
  | "LABORAL_GENERAL"
  | "LABORAL_BANCO"
  | "LABORAL_VISA"
  | "INGRESO_SALARIO"
  | "RETIRO"
  | "PAZ_Y_SALVO";

const LETTER_TYPES: Array<{ value: LetterType; label: string }> = [
  { value: "LABORAL_GENERAL", label: "General employment letter" },
  { value: "LABORAL_BANCO", label: "Bank employment letter" },
  { value: "LABORAL_VISA", label: "Visa employment letter" },
  { value: "INGRESO_SALARIO", label: "Income and salary letter" },
  { value: "RETIRO", label: "Retirement letter" },
  { value: "PAZ_Y_SALVO", label: "Clearance letter" },
];

export function LettersPanel() {
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [tipo, setTipo] = useState<LetterType>("LABORAL_GENERAL");
  const [destinatario, setDestinatario] = useState("");
  const [proposito, setProposito] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatusMessage("");
    try {
      const response = await fetch("/api/hcm/cartas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, destinatario, proposito }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(errorText || "Unable to create letter request.");
      }

      const created = (await response.json()) as { cartaCode: string; status: string };
      setStatusMessage(`Request created: ${created.cartaCode} (${created.status}).`);
      setDestinatario("");
      setProposito("");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to create letter request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border border-default-200/50">
      <CardBody className="space-y-4 p-5">
        <div>
          <h3 className="text-lg font-semibold">Employment letters</h3>
          <p className="text-sm text-default-500">Request official HR letters with destination and purpose.</p>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <Select
            isRequired
            label="Letter type"
            selectedKeys={[tipo]}
            variant="bordered"
            onSelectionChange={(keys) => setTipo(String(Array.from(keys)[0]) as LetterType)}
          >
            {LETTER_TYPES.map((item) => (
              <SelectItem key={item.value}>{item.label}</SelectItem>
            ))}
          </Select>

          <Input
            label="Destination"
            value={destinatario}
            variant="bordered"
            onValueChange={setDestinatario}
          />

          <Input
            label="Purpose"
            value={proposito}
            variant="bordered"
            onValueChange={setProposito}
          />

          <Button color="primary" isDisabled={saving} isLoading={saving} type="submit">
            Submit letter request
          </Button>
        </form>

        {statusMessage ? (
          <p aria-live="polite" className="text-sm text-default-600" role="status">{statusMessage}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}
