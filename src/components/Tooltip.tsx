import React, { useState, useRef, useEffect } from "react";
import { Info, HelpCircle } from "lucide-react";

interface TooltipProps {
  title?: string;
  content: React.ReactNode;
  children?: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  badgeText?: string;
  iconType?: "info" | "help";
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  title,
  content,
  children,
  position = "top",
  badgeText,
  iconType = "info",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Position classes
  const getPositionClasses = () => {
    switch (position) {
      case "bottom":
        return "top-full mt-2 left-1/2 -translate-x-1/2";
      case "left":
        return "right-full mr-2 top-1/2 -translate-y-1/2";
      case "right":
        return "left-full ml-2 top-1/2 -translate-y-1/2";
      case "top":
      default:
        return "bottom-full mb-2 left-1/2 -translate-x-1/2";
    }
  };

  const IconComponent = iconType === "help" ? HelpCircle : Info;

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center align-middle ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {children ? (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className="cursor-help inline-flex items-center"
        >
          {children}
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className="text-slate-400 hover:text-emerald-400 focus:outline-none p-0.5 rounded-full transition cursor-pointer hover:bg-slate-800/80"
          aria-label={title || "المزيد من المعلومات"}
        >
          <IconComponent className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Floating Tooltip Bubble */}
      {isOpen && (
        <div
          className={`absolute z-50 w-72 sm:w-80 p-3.5 bg-slate-900/98 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl text-xs text-slate-300 font-sans pointer-events-auto select-text leading-relaxed text-right rtl:text-right ltr:text-left transition-all duration-200 animate-in fade-in zoom-in-95 ${getPositionClasses()}`}
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header if title or badge exists */}
          {(title || badgeText) && (
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800/90 font-semibold">
              <div className="flex items-center gap-1.5 text-white font-bold text-xs">
                <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{title}</span>
              </div>
              {badgeText && (
                <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-medium shrink-0">
                  {badgeText}
                </span>
              )}
            </div>
          )}

          {/* Content Body */}
          <div className="text-[11.5px] leading-relaxed text-slate-300 space-y-1">
            {content}
          </div>

          {/* Micro arrow hint */}
          <div
            className={`absolute w-2 h-2 bg-slate-900 border-slate-700/80 rotate-45 pointer-events-none ${
              position === "bottom"
                ? "-top-1 border-t border-l left-1/2 -translate-x-1/2"
                : position === "left"
                ? "-right-1 border-t border-r top-1/2 -translate-y-1/2"
                : position === "right"
                ? "-left-1 border-b border-l top-1/2 -translate-y-1/2"
                : "-bottom-1 border-b border-r left-1/2 -translate-x-1/2"
            }`}
          />
        </div>
      )}
    </div>
  );
};
