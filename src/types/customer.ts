export type Address = {
  id: string;
  label?: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  reference?: string;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  addresses: Address[];
  createdAt: string;
  updatedAt: string;
};

export type AuthPayload = {
  token: string;
  customer: Customer;
};

