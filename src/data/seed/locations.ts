import type { Location } from '../../db/types'
import { blankLocationFields } from '../../domain/locations'

type Row = [name: string, lat: number, lng: number, osm: string, isReference?: boolean]

/**
 * Localidades iniciais. Coordenadas do OpenStreetMap (Nominatim), consultadas em 2026-11-19.
 * Somente nome e posição — nenhum outro dado é preenchido (ver spec §15 e §16).
 * Cada lote tem uma versão: aparelhos que já usam o app recebem só os lotes novos.
 */
const V1: Row[] = [
  ['Cork City', 51.8985136, -8.4726423, 'relation/11797890', true],
  ['Ballincollig', 51.8882643, -8.5918414, 'node/52231176'],
  ['Cobh', 51.8502284, -8.2950649, 'relation/14579064'],
  ['Midleton', 51.9142741, -8.1700962, 'relation/14571803'],
  ['Bandon', 51.7461712, -8.7369303, 'relation/14584354'],
  ['Glanmire', 51.9192272, -8.3959789, 'node/52252757'],
]

/** Lote 2 (2026-11-19): todas a até ~1 h de carro de Cork City (OSRM, sem trânsito). */
const V2: Row[] = [
  ['Douglas', 51.8775545, -8.4358941, 'node/1459892239'],
  ['Bishopstown', 51.8796067, -8.5166631, 'node/52234612'],
  ['Wilton', 51.8826552, -8.5072082, 'node/576721416'],
  ['Togher', 51.8767758, -8.4939627, 'node/52259434'],
  ['Blackrock', 51.8974571, -8.4130853, 'node/52245836'],
  ['Mahon', 51.8938281, -8.3979873, 'node/918714078'],
  ['Mayfield', 51.9124385, -8.4328014, 'node/8563682'],
  ['Ballyvolane', 51.9180432, -8.4538752, 'relation/5479894'],
  ['Rochestown', 51.8752284, -8.4023724, 'node/7801743090'],
  ['Carrigaline', 51.8149556, -8.3922675, 'relation/14574399'],
  ['Passage West', 51.8711088, -8.3354199, 'relation/14579065'],
  ['Monkstown', 51.8483695, -8.3333967, 'node/52260215'],
  ['Blarney', 51.9324626, -8.5680966, 'relation/14578683'],
  ['Tower', 51.9251322, -8.6079225, 'relation/14607806'],
  ['Little Island', 51.9035274, -8.3541241, 'node/895511456'],
  ['Carrigtwohill', 51.9094617, -8.2611809, 'node/52260792'],
  ['Ovens', 51.8869169, -8.6679485, 'relation/6934552'],
  ['Crosshaven', 51.8023829, -8.2953269, 'relation/14612610'],
  ['Kinsale', 51.7057370, -8.5229823, 'relation/14571368'],
  ['Mallow', 52.1373851, -8.6450328, 'relation/14571792'],
  ['Fermoy', 52.1381665, -8.2752230, 'relation/14587084'],
  ['Youghal', 51.9494736, -7.8431892, 'relation/14582880'],
  ['Macroom', 51.9049705, -8.9599195, 'relation/14571677'],
  ['Clonakilty', 51.6232159, -8.8914072, 'relation/14584068'],
  ['Mitchelstown', 52.2661629, -8.2708001, 'relation/14571742'],
]

const toLocation = ([name, lat, lng, osm, isReference]: Row): Location => ({
  name,
  lat,
  lng,
  coordSource: `https://www.openstreetmap.org/${osm}`,
  builtIn: true,
  isReference: isReference === true,
  ...blankLocationFields(),
})

export const SEED_BATCHES: { version: number; locations: Location[] }[] = [
  { version: 1, locations: V1.map(toLocation) },
  { version: 2, locations: V2.map(toLocation) },
]

export const LOCATIONS_SEED_VERSION = SEED_BATCHES[SEED_BATCHES.length - 1].version

export const INITIAL_LOCATIONS: Location[] = SEED_BATCHES.flatMap((b) => b.locations)
