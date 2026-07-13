import logoWhite from "@/assets/logo-zelo-transparent-white.png";
import logoBlack from "@/assets/logo-zelo-transparent-black.png";
import compactWhite from "@/assets/logo-zelo-compact-transparent-white.png";
import compactBlack from "@/assets/logo-zelo-compact-transparent-black.png";
import { cn } from "@/lib/utils";

type ZeloLogoProps = {
  className?: string;
  imageClassName?: string;
  alt?: string;
  bare?: boolean;
  compact?: boolean;
};

export function ZeloLogo({
  className,
  imageClassName,
  alt = "Zelo",
  bare = false,
  compact = false,
}: ZeloLogoProps) {
  const whiteSource = compact ? compactWhite : logoWhite;
  const blackSource = compact ? compactBlack : logoBlack;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl",
        bare
          ? "border-0 bg-transparent shadow-none"
          : "border border-primary/20 bg-primary shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {bare ? (
        <>
          <img
            src={blackSource}
            alt={alt}
            className={cn("h-full w-full object-contain dark:hidden", imageClassName)}
          />
          <img
            src={whiteSource}
            alt=""
            aria-hidden="true"
            className={cn("hidden h-full w-full object-contain dark:block", imageClassName)}
          />
        </>
      ) : (
        <>
          <img
            src={whiteSource}
            alt={alt}
            className={cn("h-full w-full object-contain dark:hidden", imageClassName)}
          />
          <img
            src={blackSource}
            alt=""
            aria-hidden="true"
            className={cn("hidden h-full w-full object-contain dark:block", imageClassName)}
          />
        </>
      )}
    </div>
  );
}
