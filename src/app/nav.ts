export interface NavItem {
  path: string
  label: string
  stage: number
  enabled: boolean
}

/** Ordem definida no escopo. Cada item é habilitado na etapa em que o módulo fica pronto. */
export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', stage: 1, enabled: true },
  { path: '/renda', label: 'Simulador de renda', stage: 2, enabled: true },
  { path: '/despesas', label: 'Despesas', stage: 2, enabled: true },
  { path: '/mapa', label: 'Mapa de Cork', stage: 4, enabled: true },
  { path: '/seguranca', label: 'Segurança', stage: 6, enabled: true },
  { path: '/comparador', label: 'Comparador de localidades', stage: 5, enabled: true },
  { path: '/imoveis', label: 'Imóveis', stage: 5, enabled: true },
  { path: '/configuracoes', label: 'Configurações', stage: 1, enabled: true },
]
