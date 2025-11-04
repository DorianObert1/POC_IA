export type DataPoint = {
  date: string
  category: string
  metricA: number
  metricB: number
  metricC: number
}

export type Dataset = DataPoint[]

export type Filters = {
  categories: string[]
}

export type ReportOptions = {
  tone: 'neutre' | 'executif' | 'detaille'
  locale: 'fr' | 'en'
}
