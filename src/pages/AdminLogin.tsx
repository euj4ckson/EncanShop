import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { isUsingDefaultPassword, loginWithPassword } from "@/lib/auth";

const schema = z.object({
  password: z.string().min(4, "Informe a senha")
});

type FormValues = z.infer<typeof schema>;

export function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "" }
  });

  const handleSubmit = (values: FormValues) => {
    const ok = loginWithPassword(values.password);
    if (!ok) {
      form.setError("password", { message: "Senha incorreta" });
      return;
    }
    onSuccess();
  };

  return (
    <div className="section-shell flex min-h-[70vh] items-center justify-center py-24">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="font-serif text-2xl text-ink-900">Acesso Admin</h1>
          <p className="text-sm text-ink-600">Entre com a senha para gerenciar produtos.</p>
        </CardHeader>
        <CardContent>
          {isUsingDefaultPassword() ? (
            <div className="mb-4 rounded-2xl border border-gold-300/70 bg-gold-100/80 p-3 text-xs text-ink-700">
              Você ainda está usando a senha padrão. Troque em `VITE_ADMIN_PASSWORD`.
            </div>
          ) : null}
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" {...form.register("password")} />
              <p className="text-xs text-red-500">{form.formState.errors.password?.message}</p>
            </div>
            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


