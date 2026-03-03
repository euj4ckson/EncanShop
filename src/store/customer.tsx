import * as React from "react";
import type { Address, Customer } from "@/types/customer";
import { CustomerRepo } from "@/services/customerRepo";
import { clearCustomerToken, getCustomerToken, setCustomerToken } from "@/lib/customerAuth";

type CustomerContextValue = {
  customer: Customer | null;
  isLoading: boolean;
  isAuthed: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  updatePhone: (phone: string) => Promise<void>;
  updateProfile: (input: { name?: string; phone?: string }) => Promise<void>;
  saveAddress: (address: Partial<Address>, id?: string) => Promise<void>;
  removeAddress: (id: string) => Promise<void>;
};

const CustomerContext = React.createContext<CustomerContextValue | null>(null);

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    const token = getCustomerToken();
    if (!token) {
      setCustomer(null);
      setIsLoading(false);
      return;
    }
    try {
      const profile = await CustomerRepo.getProfile();
      setCustomer(profile);
    } catch {
      clearCustomerToken();
      setCustomer(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = React.useMemo<CustomerContextValue>(
    () => ({
      customer,
      isLoading,
      isAuthed: Boolean(customer),
      login: async (input) => {
        const payload = await CustomerRepo.login(input);
        setCustomerToken(payload.token);
        setCustomer(payload.customer);
      },
      register: async (input) => {
        const payload = await CustomerRepo.register(input);
        setCustomerToken(payload.token);
        setCustomer(payload.customer);
      },
      logout: () => {
        clearCustomerToken();
        setCustomer(null);
      },
      refresh,
      updateName: async (name) => {
        const updated = await CustomerRepo.updateName(name);
        setCustomer(updated);
      },
      updatePhone: async (phone) => {
        const updated = await CustomerRepo.updateProfile({ phone });
        setCustomer(updated);
      },
      updateProfile: async (input) => {
        const updated = await CustomerRepo.updateProfile(input);
        setCustomer(updated);
      },
      saveAddress: async (address, id) => {
        if (id) {
          await CustomerRepo.updateAddress(id, address);
        } else {
          await CustomerRepo.createAddress(address);
        }
        await refresh();
      },
      removeAddress: async (id) => {
        await CustomerRepo.removeAddress(id);
        await refresh();
      }
    }),
    [customer, isLoading, refresh]
  );

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomer() {
  const context = React.useContext(CustomerContext);
  if (!context) {
    throw new Error("useCustomer must be used within CustomerProvider");
  }
  return context;
}

