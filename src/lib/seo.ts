import { useEffect } from "react";
import { APP_NAME } from "@/lib/config";

type SeoOptions = {
  title: string;
  description: string;
};

export function useSeo({ title, description }: SeoOptions): void {
  useEffect(() => {
    document.title = `${title} | ${APP_NAME}`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
  }, [title, description]);
}



