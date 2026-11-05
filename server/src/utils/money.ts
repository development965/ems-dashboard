import type { Prisma } from "@prisma/client";

/** Prisma returns Decimal fields as Decimal objects — convert to a plain number for JSON responses. */
export function toMoney(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : value.toNumber();
}
