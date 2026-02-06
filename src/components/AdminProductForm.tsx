import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { fileToBase64 } from "@/lib/file";

const imageSchema = z
  .string()
  .min(5)
  .refine((value) => value.startsWith("http") || value.startsWith("data:image"), {
    message: "Use uma URL válida ou imagem enviada"
  });

const productSchema = z.object({
  name: z.string().min(2, "Informe o nome"),
  price: z.number().min(1, "Informe o preço"),
  description: z.string().min(10, "Descreva o produto"),
  category: z.string().min(2, "Informe a categoria"),
  images: z.array(imageSchema).min(1, "Inclua ao menos 1 imagem").max(3),
  featured: z.boolean().default(false),
  inStock: z.boolean().default(true)
});

export type AdminProductFormValues = z.infer<typeof productSchema>;

export function AdminProductForm({
  initialValues,
  onSubmit,
  onCancel
}: {
  initialValues?: AdminProductFormValues;
  onSubmit: (values: AdminProductFormValues) => void;
  onCancel?: () => void;
}) {
  const form = useForm<AdminProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: initialValues ?? {
      name: "",
      price: 0,
      description: "",
      category: "",
      images: [],
      featured: false,
      inStock: true
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "images"
  });

  const maxReached = fields.length >= 3;

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [form, initialValues]);

  const handleFileUpload = async (file?: File) => {
    if (!file || maxReached) return;
    const dataUrl = await fileToBase64(file);
    append(dataUrl);
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="glass-panel space-y-4 p-6"
    >
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" {...form.register("name")} />
        <p className="text-xs text-red-500">{form.formState.errors.name?.message}</p>
      </div>
      <div>
        <Label htmlFor="price">Preço</Label>
        <Input
          id="price"
          type="number"
          step="0.01"
          {...form.register("price", { valueAsNumber: true })}
        />
        <p className="text-xs text-red-500">{form.formState.errors.price?.message}</p>
      </div>
      <div>
        <Label htmlFor="category">Categoria</Label>
        <Input id="category" {...form.register("category")} />
        <p className="text-xs text-red-500">{form.formState.errors.category?.message}</p>
      </div>
      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" rows={4} {...form.register("description")} />
        <p className="text-xs text-red-500">{form.formState.errors.description?.message}</p>
      </div>

      <div className="space-y-2">
        <Label>Imagens (até 3)</Label>
        {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          <Input {...form.register(`images.${index}` as const)} />
          <Button
            type="button"
            variant="ghost"
            onClick={() => remove(index)}
            aria-label="Remover imagem"
          >
            Remover
          </Button>
        </div>
        ))}
        {form.formState.errors.images?.message ? (
          <p className="text-xs text-red-500">{form.formState.errors.images?.message}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => append("")} disabled={maxReached}
          >
            Adicionar URL
          </Button>
          <label
            className={`inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-sand-200/70 bg-white/70 px-3 py-2 text-sm text-ink-700 transition hover:bg-white ${
              maxReached ? "opacity-50" : ""
            }`}
          >
            Upload local
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={maxReached}
              onChange={(event) => handleFileUpload(event.target.files?.[0])}
            />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" {...form.register("featured")} />
          Destaque
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" {...form.register("inStock")} />
          Em estoque
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit">Salvar</Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}


