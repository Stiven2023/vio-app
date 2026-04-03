type ContractTypeKey =
  | "FIXED_TERM"
  | "INDEFINITE_TERM"
  | "WORK_CONTRACT"
  | "SERVICE_CONTRACT"
  | null;

type EmployeeSeed = {
  id: string;
  name: string | null;
  employeeCode: string | null;
  contractType: ContractTypeKey;
};

export type WorkScheduleEntry = {
  date: string;
  hours: number;
  shift: "MORNING" | "AFTERNOON" | "NIGHT" | "OFF";
  isOperator: boolean;
};

export type EmployeeMonthSchedule = {
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  contractType: ContractTypeKey;
  totalHours: number;
  entries: WorkScheduleEntry[];
};

function toHash(value: string) {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }

  return hash;
}

function monthRange(month: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));

  return { start, end };
}

function toIsoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isOperator(contractType: ContractTypeKey) {
  return contractType === "WORK_CONTRACT";
}

function baseHours(day: number) {
  if (day === 0) return 0;
  if (day === 6) return 6;

  return 8;
}

function resolveShift(isOp: boolean, seed: number, date: Date) {
  const day = date.getUTCDay();

  if (day === 0) return "OFF" as const;
  if (!isOp) return "MORNING" as const;

  const rotation = ["MORNING", "AFTERNOON", "NIGHT"] as const;
  const dayOfMonth = date.getUTCDate();
  const index = (seed + dayOfMonth) % rotation.length;

  return rotation[index];
}

export function normalizeMonth(monthText: string | null | undefined) {
  if (monthText && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthText)) return monthText;

  const today = new Date();
  const month = String(today.getUTCMonth() + 1).padStart(2, "0");

  return `${today.getUTCFullYear()}-${month}`;
}

export function buildMonthSchedule(
  employee: EmployeeSeed,
  month: string,
): EmployeeMonthSchedule {
  const { start, end } = monthRange(month);
  const seed = toHash(employee.id);
  const op = isOperator(employee.contractType);

  const entries: WorkScheduleEntry[] = [];
  let totalHours = 0;

  for (
    let cursor = new Date(start);
    cursor.getTime() <= end.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const day = cursor.getUTCDay();
    const hours = baseHours(day);
    const shift = resolveShift(op, seed, cursor);

    entries.push({
      date: toIsoDay(cursor),
      hours,
      shift,
      isOperator: op,
    });

    totalHours += hours;
  }

  return {
    employeeId: employee.id,
    employeeName: employee.name ?? "Sin nombre",
    employeeCode: employee.employeeCode,
    contractType: employee.contractType,
    totalHours,
    entries,
  };
}

export function buildWeekFromMonth(
  monthSchedule: EmployeeMonthSchedule,
  weekStart: string,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return monthSchedule.entries.slice(0, 7);
  }

  const startDate = new Date(`${weekStart}T00:00:00.000Z`);

  if (Number.isNaN(startDate.getTime())) {
    return monthSchedule.entries.slice(0, 7);
  }

  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 6);

  const startIso = toIsoDay(startDate);
  const endIso = toIsoDay(endDate);

  return monthSchedule.entries.filter(
    (entry) => entry.date >= startIso && entry.date <= endIso,
  );
}
