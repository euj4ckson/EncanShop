import { getAdminPassword } from "@/lib/auth";
import { requestJson } from "@/services/http";

function adminHeaders(): HeadersInit {
  return {
    "x-admin-password": getAdminPassword()
  };
}

export type AdminEmailTestStage = "order_created" | "payment_approved" | "preparing" | "shipped";

export type AdminEmailTestResult = {
  stage: AdminEmailTestStage;
  customerSent: boolean;
  adminSent: boolean;
  customerProvider?: string;
  customerError?: string;
  adminProvider?: string;
  adminError?: string;
};

export type AdminEmailTestResponse = {
  ok: boolean;
  adminEmail: string;
  customerEmail: string;
  results: AdminEmailTestResult[];
  successCount: number;
  attempts: number;
};

export const AdminRepo = {
  async sendEmailTest(input?: {
    customerEmail?: string;
    customerName?: string;
  }): Promise<AdminEmailTestResponse> {
    return requestJson<AdminEmailTestResponse>("/api/admin-email-test", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(input || {})
    });
  }
};
