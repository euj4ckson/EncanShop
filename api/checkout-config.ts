import { json } from "./_lib/http";
import { getPublicKey } from "./_lib/mercadopago";

export default async function handler(_req: any, res: any) {
  try {
    return json(res, 200, {
      mercadopagoPublicKey: getPublicKey(),
      maxInstallments: 4
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return json(res, 500, { error: message });
  }
}

