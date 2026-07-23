export function PageHeader({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {descricao ? (
          <p className="text-sm text-muted-foreground">{descricao}</p>
        ) : null}
      </div>
      {children ? <div className="flex gap-2">{children}</div> : null}
    </div>
  );
}
