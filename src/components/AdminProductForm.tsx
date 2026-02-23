import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { fileToBase64 } from "@/lib/file";

function parsePriceInput(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;

  let normalized = value.trim();
  if (!normalized) return Number.NaN;

  // Accept pt-BR decimals like "49,90" and thousand separators like "1.234,56"
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }

  normalized = normalized.replace(/[^\d.-]/g, "");
  return Number(normalized);
}

const imageSchema = z
  .string()
  .min(5)
  .refine(
    (value) =>
      value.startsWith("http") || value.startsWith("data:image") || value.startsWith("/"),
    {
      message: "Use uma URL válida, caminho local (/...) ou imagem enviada"
    }
  );

const productSchema = z.object({
  name: z.string().min(2, "Informe o nome"),
  price: z
    .number({ invalid_type_error: "Informe um preço válido" })
    .min(1, "Informe o preço"),
  description: z.string().min(10, "Descreva o produto"),
  category: z.string().min(2, "Informe a categoria"),
  images: z.array(imageSchema).min(1, "Inclua ao menos 1 imagem").max(3),
  variants: z
    .array(z.string().trim().min(1, "Informe a variação").max(40, "Máximo de 40 caracteres"))
    .max(12, "Máximo de 12 variações")
    .default([]),
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
      variants: [],
      featured: false,
      inStock: true
    }
  });

  const { fields: imageFields, append, remove } = useFieldArray({
    control: form.control,
    name: "images"
  });
  const {
    fields: variantFields,
    append: appendVariant,
    remove: removeVariant
  } = useFieldArray({
    control: form.control,
    name: "variants"
  });

  const maxReached = imageFields.length >= 3;

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
    <form onSubmit={form.handleSubmit(onSubmit)} className="glass-panel space-y-4 p-6">
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" {...form.register("name")} />
        <p className="text-xs text-red-500">{form.formState.errors.name?.message}</p>
      </div>
      <div>
        <Label htmlFor="price">Preço</Label>
        <Input
          id="price"
          type="text"
          inputMode="decimal"
          placeholder="49,90"
          {...form.register("price", { setValueAs: parsePriceInput })}
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
        {imageFields.map((field, index) => (
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
          <Button type="button" variant="outline" onClick={() => append("")} disabled={maxReached}>
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

      <div className="space-y-2">
        <Label>Variações / Cores (opcional)</Label>
        {variantFields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <Input
              placeholder="Ex.: Vermelha"
              {...form.register(`variants.${index}` as const)}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => removeVariant(index)}
              aria-label="Remover variação"
            >
              Remover
            </Button>
          </div>
        ))}
        {Array.isArray(form.formState.errors.variants)
          ? form.formState.errors.variants.map((error, index) =>
              error?.message ? (
                <p key={index} className="text-xs text-red-500">
                  {error.message}
                </p>
              ) : null
            )
          : null}
        {form.formState.errors.variants?.message ? (
          <p className="text-xs text-red-500">{form.formState.errors.variants.message}</p>
        ) : null}
        <Button type="button" variant="outline" onClick={() => appendVariant("")}>
          Adicionar variação
        </Button>
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
