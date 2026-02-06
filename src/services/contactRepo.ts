import type { Contacts } from "@/lib/contacts";
import { getContacts, setContacts } from "@/lib/contacts";

export const ContactRepo = {
  async get(): Promise<Contacts> {
    return getContacts();
  },
  async update(data: Contacts): Promise<Contacts> {
    setContacts(data);
    return data;
  }
};
