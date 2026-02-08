import type { ReactElement } from "react";

import { useEffect } from "react";
import { toast } from "react-hot-toast";

interface AlertToastProps {
  message: string;
  type?: "success" | "error" | "warning" | "info";
  icon?: string | ReactElement;
  duration?: number;
}

export function AlertToast({
  message,
  type = "info",
  icon,
  duration = 4000,
}: AlertToastProps) {
  useEffect(() => {
    const id = `alert:${type}:${message}`;
    const isValidIcon =
      icon && (typeof icon === "string" || typeof icon === "object");
    const options = { id, duration, ...(isValidIcon && { icon }) };

    switch (type) {
      case "success":
        toast.success(message, options);
        break;
      case "error":
        toast.error(message, options);
        break;
      case "warning":
        toast(message, {
          ...options,
          style: { background: "#f59e42", color: "#fff" },
        });
        break;
      default:
        toast(message, options);
        break;
    }
    // Solo se ejecuta cuando cambian los props
  }, [message, type, icon, duration]);

  return null;
}
