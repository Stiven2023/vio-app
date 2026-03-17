import { ORDER_STATUS } from "@/src/utils/order-status";

const PREPRODUCTION_UPDATE_ORDER_STATUSES = new Set<string>([
  ORDER_STATUS.APROBACION,
  ORDER_STATUS.PROGRAMACION,
]);

export function shouldRouteDesignUpdateToApproval(args: {
  orderStatus: string | null | undefined;
  quantityChanged: boolean;
  requestedStatusProvided: boolean;
  designChanged: boolean;
  tallaChanged: boolean;
}) {
  const orderStatus = String(args.orderStatus ?? "").trim().toUpperCase();

  if (args.requestedStatusProvided) return false;
  if (args.quantityChanged) return false;
  if (!PREPRODUCTION_UPDATE_ORDER_STATUSES.has(orderStatus)) return false;

  return args.designChanged || args.tallaChanged;
}
