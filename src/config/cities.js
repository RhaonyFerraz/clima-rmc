/**
 * Cidades monitoradas da Região Metropolitana de Campinas (RMC)
 * Coordenadas geográficas oficiais e dados demográficos de referência.
 */
const CITIES = [
  {
    id: 'campinas',
    name: 'Campinas',
    state: 'SP',
    latitude: -22.9056,
    longitude: -47.0608,
    elevation: 685,
    description: 'Sede da Região Metropolitana de Campinas e polo de ciência e tecnologia.',
    population: 1139047
  },
  {
    id: 'sumare',
    name: 'Sumaré',
    state: 'SP',
    latitude: -22.8206,
    longitude: -47.2669,
    elevation: 583,
    description: 'Importante polo industrial e logístico da RMC, cortado pelo Corredor Metropolitano.',
    population: 279545
  },
  {
    id: 'hortolandia',
    name: 'Hortolândia',
    state: 'SP',
    latitude: -22.8583,
    longitude: -47.2200,
    elevation: 587,
    description: 'Destaque nacional em atração de empresas de alta tecnologia, data centers e indústria farmacêutica.',
    population: 236641
  }
];

function getCityById(id) {
  if (!id) return null;
  return CITIES.find(c => c.id.toLowerCase() === id.toLowerCase()) || null;
}

module.exports = {
  CITIES,
  getCityById
};
