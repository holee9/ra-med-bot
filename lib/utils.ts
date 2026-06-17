// @MX:NOTE [AUTO] Utility functions for Tailwind className merging.
// Replaces the 'clsx' and 'classnames' libraries with a lightweight alternative.

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx and tailwind-merge.
 * This utility ensures proper class precedence and avoids duplicates.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}