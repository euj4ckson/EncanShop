import { useQuery } from "@tanstack/react-query";
import { ContactRepo } from "@/services/contactRepo";

export function useContacts() {
  return useQuery({
    queryKey: ["contacts"],
    queryFn: ContactRepo.get,
    staleTime: Infinity
  });
}



