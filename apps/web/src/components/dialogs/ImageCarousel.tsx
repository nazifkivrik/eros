"use client";

import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface ImageCarouselProps {
  images: Array<{ url: string }>;
  alt: string;
  aspectRatio?: "video" | "portrait";
  className?: string;
}

export function ImageCarousel({
  images,
  alt,
  aspectRatio = "video",
  className = "w-full",
}: ImageCarouselProps) {
  if (!images || images.length === 0) return null;

  const aspectClass = aspectRatio === "portrait" ? "aspect-[3/4]" : "aspect-video";

  return (
    <Carousel className={className}>
      <CarouselContent>
        {images.map((img, idx) => (
          <CarouselItem key={idx}>
            <div className={`relative ${aspectClass} w-full overflow-hidden rounded-lg`}>
              <Image
                src={img.url}
                alt={`${alt} - Image ${idx + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
                className="object-cover"
                unoptimized
              />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      {images.length > 1 && (
        <>
          <CarouselPrevious className="left-2" />
          <CarouselNext className="right-2" />
        </>
      )}
    </Carousel>
  );
}
