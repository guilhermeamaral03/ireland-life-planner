export type ParamStatus = 'oficial' | 'proposto' | 'nao_disponivel'

/** Um parâmetro fiscal com sua origem. value === null ⇔ status 'nao_disponivel'. */
export interface Param<T> {
  value: T | null
  status: ParamStatus
  source: string
}

/** Faixa acumulada: aplica `rate` até `upTo` (null = todo o restante). */
export interface Band {
  upTo: number | null
  rate: number
}

export interface TaxRules {
  year: number
  status: 'oficial' | 'proposto'
  statusNote: string
  notes: string[]
  incomeTax: {
    standardRate: Param<number>
    higherRate: Param<number>
    bands: {
      solteiro: Param<number>
      pai_mae_solteiro: Param<number>
      casado_uma_renda: Param<number>
      casado_duas_rendas_base: Param<number>
      casado_duas_rendas_max_increase: Param<number>
    }
    credits: {
      personal_single: Param<number>
      personal_married: Param<number>
      employee: Param<number>
      spcc: Param<number>
      /** O crédito de empregado é limitado a esta fração da renda PAYE de cada pessoa. */
      employee_income_rate: Param<number>
    }
    rentCredit: {
      rate: Param<number>
      max_single: Param<number>
      max_couple: Param<number>
    }
  }
  usc: {
    exemption: Param<number>
    bands: Param<Band[]>
    reducedIncomeLimit: Param<number>
    reducedBands: Param<Band[]>
  }
  prsi: {
    /** Renda semanal até este valor: sem PRSI do empregado. */
    weeklyExemption: Param<number>
    creditMax: Param<number>
    /** A redução do crédito é calculada sobre a renda acima deste valor. */
    creditTaperFrom: Param<number>
    creditUpTo: Param<number>
    creditTaperDivisor: Param<number>
    ratePeriods: Param<{ from: string; rate: number }[]>
  }
}
