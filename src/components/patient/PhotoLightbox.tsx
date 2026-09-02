import { useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface LightboxPhoto {
  url: string;
  file_name?: string;
}

interface Props {
  photos: LightboxPhoto[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

const PhotoLightbox = ({ photos, index, onClose, onIndexChange }: Props) => {
  const open = index !== null && photos.length > 0;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndexChange(((index as number) + 1) % photos.length);
      if (e.key === "ArrowLeft") onIndexChange(((index as number) - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, index, photos.length, onClose, onIndexChange]);

  if (!open) return null;
  const photo = photos[index as number];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
        title="Fechar (Esc)"
      >
        <X className="w-6 h-6" />
      </button>

      {photos.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onIndexChange(((index as number) - 1 + photos.length) % photos.length); }}
          className="absolute left-2 sm:left-4 text-white/80 hover:text-white p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
          title="Anterior"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
      )}

      <img
        src={photo.url}
        alt={photo.file_name || ""}
        className="max-w-[90vw] max-h-[85vh] object-contain select-none"
        onClick={(e) => e.stopPropagation()}
      />

      {photos.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onIndexChange(((index as number) + 1) % photos.length); }}
          className="absolute right-2 sm:right-4 text-white/80 hover:text-white p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
          title="Próxima"
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      )}

      {photos.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs font-medium bg-black/30 px-3 py-1 rounded-full">
          {(index as number) + 1} / {photos.length}
        </div>
      )}
    </div>
  );
};

export default PhotoLightbox;
