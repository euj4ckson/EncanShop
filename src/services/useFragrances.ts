import { useQuery } from "@tanstack/react-query";
import { FragranceRepo } from "@/services/fragranceRepo";

export function useFragrances() {
  return useQuery({
    queryKey: ["fragrances"],
    queryFn: FragranceRepo.listActive
  });
}

