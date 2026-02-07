"use client";

import { Button } from "@heroui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";

export type ConfirmActionModalProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: "danger" | "primary";
  isLoading?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
};

export function ConfirmActionModal({
  isOpen,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  confirmColor = "danger",
  isLoading,
  onConfirm,
  onOpenChange,
}: ConfirmActionModalProps) {
  return (
    <Modal
      isDismissable={!isLoading}
      isKeyboardDismissDisabled={Boolean(isLoading)}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          {description ? <p className="text-sm">{description}</p> : null}
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={Boolean(isLoading)}
            variant="flat"
            onPress={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            color={confirmColor}
            isLoading={Boolean(isLoading)}
            onPress={onConfirm}
          >
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
