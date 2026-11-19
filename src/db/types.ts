export type CategoryGroup = 'moradia' | 'transporte' | 'outros'

export interface Category {
  id?: number
  name: string
  group: CategoryGroup
  builtIn: boolean
}

export type Frequency = 'semanal' | 'mensal' | 'trimestral' | 'anual'

export interface Expense {
  id?: number
  name: string
  categoryId: number
  amount: number
  frequency: Frequency
  kind: 'fixa' | 'variavel'
}

export type TaxStatus = 'solteiro' | 'pai_mae_solteiro' | 'casado_uma_renda' | 'casado_duas_rendas'

export interface Settings {
  id: 'main'
  taxYear: number | null
  grossAnnual: number | null
  taxStatus: TaxStatus | null
  payFrequency: 'semanal' | 'quinzenal' | 'mensal'
  prsiClass: 'A'
  uscReducedRate: boolean
  /** Renda bruta anual do cônjuge (só casado com duas rendas). */
  spouseGrossAnnual: number | null
  /** Aluguel mensal para o Rent Tax Credit; null = usar o das despesas. */
  rentMonthlyOverride: number | null
  extraCredits: { name: string; amount: number }[]
  initialReserve: number | null
  projectionMonths: number
  lastBackupAt: string | null
  /** Último lote de localidades iniciais aplicado neste aparelho (0 = nenhum). */
  locationsSeedVersion: number
  /** Critérios da classificação de segurança pela tendência (editáveis). */
  safetyCriteria: { offences: string[]; baselineYears: number; moderatePct: number; highPct: number }
}

export type ScenarioKey = 'aluguel' | 'contas' | 'alimentacao' | 'transporte' | 'pessoais' | 'outros'

export interface Scenario {
  id?: number
  name: string
  /** null = usar o do simulador. */
  grossAnnual: number | null
  /** null = usar a situação do simulador. */
  taxStatus: TaxStatus | null
  /** Usado só quando o cenário define taxStatus 'casado_duas_rendas'. */
  spouseGrossAnnual: number | null
  amounts: Record<ScenarioKey, number>
  /** null = usar a reserva do simulador. */
  initialReserve: number | null
}

/** Valor factual com origem. value === null → "Não disponível". */
export interface Sourced<T> {
  value: T | null
  source: string | null
  date: string | null
  status?: 'confirmado' | 'estimado'
}

export interface Route {
  km: number
  minutes: number
}

export interface Location {
  id?: number
  name: string
  lat: number
  lng: number
  coordSource: string
  /** Localidade inicial do app. */
  builtIn: boolean
  /** Referência das distâncias (Cork City); não pode ser excluída. */
  isReference: boolean
  favorite: boolean
  description: string
  infrastructure: string
  publicTransport: string
  supermarkets: string
  services: string
  residentialProfile: string
  notes: string
  rentRange: Sourced<{ min: number; max: number }>
  /** Custo mensal de transporte até Cork City (ex.: passe de ônibus), com fonte. */
  transportMonthly: Sourced<number>
  carRoute: Sourced<Route>
  transitMinutes: Sourced<number>
  carDependency: Sourced<'baixa' | 'media' | 'alta'>
  links: string[]
  /** Estação da Garda usada para os dados de ocorrências (CSO). */
  gardaStation: { code: string; origin: 'nome' | 'usuario' } | null
}

/** Ocorrências registradas por ano e tipo de ofensa numa estação da Garda (CSO CJA11). */
export interface CrimeStation {
  code: string
  name: string
  division: string
  /** ano → código da ofensa → ocorrências (null = sem dado) */
  counts: Record<string, Record<string, number | null>>
  /** data de atualização da tabela informada pelo CSO */
  csoUpdated: string
  /** quando o app baixou os dados */
  fetchedAt: string
}

export interface SafetyRecord {
  id?: number
  locationId: number
  area: string
  periodStart: string
  periodEnd: string
  category: string
  count: number
  source: string
  updatedAt: string
  limitations: string
}

export interface Property {
  id?: number
  title: string
  url: string
  locationId: number | null
  address: string
  lat: number | null
  lng: number | null
  type: 'quarto' | 'studio' | 'apartamento' | 'casa'
  rent: number
  deposit: number | null
  billsIncluded: boolean
  billsMonthly: number | null
  residents: number | null
  listedAt: string | null
  carRoute: Sourced<Route>
  transitMinutes: Sourced<number>
  transportMonthly: number | null
  notes: string
  favorite: boolean
}
