import Image from "next/image";
import { Film } from "lucide-react";
import { cn } from "@/lib/utils";

type EntityType = "performer" | "studio" | "scene";

interface SubscriptionImageProps {
  src: string | null;
  alt: string;
  type: EntityType;
  className?: string;
}

export function SubscriptionImage({ src, alt, type, className }: SubscriptionImageProps) {
  // Performer posters are typically 3:4 aspect ratio
  // Studio and scene posters are typically 16:9 aspect ratio
  const aspectRatio = type === "performer" ? "aspect-[3/4]" : "aspect-video";

  return (
    <div className={cn(aspectRatio, "w-full bg-muted relative", className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain"
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Film className="h-12 w-12 text-muted-foreground/30" />
        </div>
      )}
    </div>
  );
}
