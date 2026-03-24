"use client";

import { Button } from "@heroui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";

type DetailItem = {
  label: string;
  value: string;
};

export function DetailModal({
  isOpen,
  title,
  items,
  onOpenChange,
}: {
  isOpen: boolean;
  title: string;
  items: DetailItem[];
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Modal disableAnimation isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.label}
                className="rounded-md border border-default-200 p-2"
              >
                <p className="text-xs text-default-500">{item.label}</p>
                <p className="text-sm font-medium break-words">
                  {item.value || "-"}
                </p>
              </div>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
