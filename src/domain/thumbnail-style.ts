import { color } from "bun";

export interface ThumbnailStyle {
  layout: 'horizontal' | 'vertical';
  template: 'regular' | 'special';
  separatorColor: string;
}

export const separatorColors = { blue: '#0096aa', yellow: '#ffcc00' } as const;
export const defaultThumbnailStyle: Readonly<ThumbnailStyle> = {
  layout: 'vertical', template: 'regular', separatorColor: separatorColors.blue,
};

const portugueseColors = new Map(Object.entries({
  azul: separatorColors.blue, amarelo: separatorColors.yellow, amarela: separatorColors.yellow,
  vermelho: 'red', vermelha: 'red', verde: 'green', roxo: 'purple', roxa: 'purple', rosa: 'pink', laranja: 'orange',
  branco: 'white', branca: 'white', preto: 'black', preta: 'black', cinzento: 'gray', cinza: 'gray',
  castanho: 'brown', turquesa: 'turquoise', dourado: 'gold', lilás: '#c8a2c8',
}));

export function parseSeparatorColor(input: string): string | undefined {
  const name = input.trim().toLowerCase();
  const value = portugueseColors.get(name) ?? name;
  if (!/^(?:#[\da-f]{3}|#[\da-f]{6}|[a-z]{1,24})$/.test(value) || value === 'transparent') return;
  return color(value, 'hex') ?? undefined;
}
