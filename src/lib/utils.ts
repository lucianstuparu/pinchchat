import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let counter = 0;
export function genId(prefix = 'req') {
  return `${prefix}-${++counter}-${Date.now()}`;
}

export function genIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
