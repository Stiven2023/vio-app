"use client";

import { Select, SelectItem } from "@heroui/select";

type FilterOption = {
  value: string;
  label: string;
};

type FilterSelectProps = {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  isDisabled?: boolean;
  className?: string;
};

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  isDisabled,
  className,
}: FilterSelectProps) {
  return (
    <Select
      className={className}
      isDisabled={isDisabled}
      label={label}
      selectedKeys={new Set([value])}
      size="sm"
      onSelectionChange={(keys) => {
        const first = Array.from(keys)[0];
        if (typeof first === "string") onChange(first);
      }}
    >
      {options.map((opt) => (
        <SelectItem key={opt.value}>{opt.label}</SelectItem>
      ))}
    </Select>
  );
}
