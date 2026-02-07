"use client";

import { Input } from "@heroui/input";
import { useEffect, useMemo, useRef } from "react";

type OtpInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  length?: number;
  isDisabled?: boolean;
  focusOnMount?: boolean;
};

const onlyDigits = (value: string) => value.replace(/\D/g, "");

export function OtpInput({
  value,
  onValueChange,
  length = 6,
  isDisabled,
  focusOnMount,
}: OtpInputProps) {
  const sanitized = useMemo(
    () => onlyDigits(value).slice(0, length),
    [value, length],
  );
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!focusOnMount) return;
    const first = inputsRef.current[0];

    first?.focus();
  }, [focusOnMount]);

  const chars = useMemo(() => {
    const arr = new Array<string>(length).fill("");

    for (let i = 0; i < length; i += 1) arr[i] = sanitized[i] ?? "";

    return arr;
  }, [sanitized, length]);

  const setAt = (index: number, digit: string) => {
    const next = chars.slice();

    next[index] = digit;
    onValueChange(next.join(""));
  };

  const focusIndex = (index: number) => {
    const el = inputsRef.current[index];

    el?.focus();
    el?.select?.();
  };

  const handlePaste = (startIndex: number, text: string) => {
    const digits = onlyDigits(text)
      .slice(0, length - startIndex)
      .split("");

    if (digits.length === 0) return;

    const next = chars.slice();

    for (let i = 0; i < digits.length; i += 1) {
      next[startIndex + i] = digits[i] ?? "";
    }

    onValueChange(next.join(""));

    const nextFocus = Math.min(startIndex + digits.length, length - 1);

    focusIndex(nextFocus);
  };

  return (
    <div className="flex gap-2">
      {chars.map((ch: string, i: number) => (
        <Input
          key={i}
          ref={(el: HTMLInputElement | null) => {
            inputsRef.current[i] = el;
          }}
          aria-label={`Dígito ${i + 1}`}
          className="w-12"
          classNames={{ input: "text-center" }}
          inputMode="numeric"
          isDisabled={isDisabled}
          maxLength={1}
          pattern="[0-9]*"
          type="text"
          value={ch}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Backspace") {
              if (chars[i]) {
                e.preventDefault();
                setAt(i, "");

                return;
              }
              if (i > 0) {
                e.preventDefault();
                focusIndex(i - 1);
              }

              return;
            }

            if (e.key === "ArrowLeft" && i > 0) {
              e.preventDefault();
              focusIndex(i - 1);

              return;
            }
            if (e.key === "ArrowRight" && i < length - 1) {
              e.preventDefault();
              focusIndex(i + 1);
            }
          }}
          onPaste={(e: React.ClipboardEvent<HTMLInputElement>) => {
            e.preventDefault();
            const text: string = e.clipboardData.getData("text");

            handlePaste(i, text);
          }}
          onValueChange={(raw: string) => {
            const digit: string = onlyDigits(raw).slice(-1);

            setAt(i, digit);
            if (digit && i < length - 1) focusIndex(i + 1);
          }}
        />
      ))}
    </div>
  );
}
