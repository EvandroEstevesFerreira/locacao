// Fallback de toda navegação dentro de (app), inclusive as 17 páginas de
// formulário — por isso é o spinner neutro e não um esqueleto de tabela, que
// era o que existia aqui antes e nunca casava com a forma da tela.
//
// As rotas de payload pesado têm `loading.tsx` próprio, com o esqueleto da
// forma real (ver src/components/shared/skeletons.tsx).
import { SpinnerCarregando } from "@/components/shared/skeletons";

export default function Loading() {
  return <SpinnerCarregando />;
}
