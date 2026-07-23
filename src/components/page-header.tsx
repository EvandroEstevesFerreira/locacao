export function PageHeader({
  titulo,
  descricao,
  eyebrow,
  children,
}: {
  titulo: string;
  descricao?: string;
  eyebrow?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? <div className="eyebrow mb-1.5">{eyebrow}</div> : null}
        <h1 className="text-4xl font-semibold tracking-tight">{titulo}</h1>
        {descricao ? (
          <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
        ) : null}
      </div>
      {children ? <div className="flex gap-2">{children}</div> : null}
    </div>
  );
}
