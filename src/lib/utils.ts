import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatPhone = (value: string): string => {
  // Remove tudo que não for dígito
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  // celular: (xx) xxxxx xxxx — fixo: (xx) xxxx xxxx
  if (digits.length <= 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)} ${digits.slice(6)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)} ${digits.slice(7)}`;
};
