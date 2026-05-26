import { useState, useEffect } from "react";
import { loadImage } from "@/lib/image-store";
import { Wine } from "lucide-react";

interface DrinkImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

export function DrinkImage({ src, alt, className = "", fallbackClassName = "" }: DrinkImageProps) {
  const [resolvedImage, setResolvedImage] = useState<string | null>(
    src && !src.startsWith("idb:") ? src : null
  );

  useEffect(() => {
    if (src && src.startsWith("idb:")) {
      const key = src.slice(4); // strip "idb:"
      loadImage(key)
        .then((url) => setResolvedImage(url))
        .catch(() => setResolvedImage(null));
    } else {
      setResolvedImage(src ?? null);
    }
  }, [src]);

  if (resolvedImage) {
    return (
      <img
        src={resolvedImage}
        alt={alt}
        className={className}
        onError={() => {
          setResolvedImage(null);
        }}
      />
    );
  }

  return (
    <div className={`bg-primary/10 flex items-center justify-center ${fallbackClassName || className}`}>
      <Wine className="h-10 w-10 text-primary/40" />
    </div>
  );
}
