import logoSource from "@/assets/logo-zelo-transparent.png";
import { cn } from "@/lib/utils";

type ZeloLogoProps = {
  className?: string;
  imageClassName?: string;
  alt?: string;
};

export function ZeloLogo({
  className,
  imageClassName,
  alt = "Zelo",
}: ZeloLogoProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-primary shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <img
        src={logoSource}
        alt={alt}
        className={cn("h-full w-full object-contain", imageClassName)}
      />
    </div>
  );
}
