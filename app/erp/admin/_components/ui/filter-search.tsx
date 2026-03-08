"use client";

import { Input } from "@heroui/input";

import { SearchIcon } from "@/components/icons";

type FilterSearchProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function FilterSearch({
  value,
  onValueChange,
  placeholder = "Buscar…",
  className,
}: FilterSearchProps) {
  return (
    <Input
      isClearable
      className={className}
      placeholder={placeholder}
      size="lg"
      startContent={<SearchIcon />}
      value={value}
      onValueChange={onValueChange}
    />
  );
}
