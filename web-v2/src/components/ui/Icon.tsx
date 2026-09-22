"use client";

import { Icon as IconifyIcon } from "@iconify/react";
import { cn } from "@/lib/utils";

export function Icon({
  icon,
  className,
  width = 18,
}: {
  icon: string;
  className?: string;
  width?: number;
}) {
  return <IconifyIcon icon={icon} width={width} className={cn("shrink-0", className)} />;
}
