import { Link, type LinkProps } from "react-router-dom";
import { prefetchRoute } from "@/routes/prefetch";

export function PrefetchLink({ to, onMouseEnter, onFocus, ...props }: LinkProps) {
  const handlePrefetch = () => {
    prefetchRoute(typeof to === "string" ? to : to.pathname ?? "");
  };
  return (
    <Link
      to={to}
      onMouseEnter={(event) => {
        handlePrefetch();
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        handlePrefetch();
        onFocus?.(event);
      }}
      {...props}
    />
  );
}



