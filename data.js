// Dados Mockados - Sistema de Saúde
// Base visual e de decisão (dados fictícios para análise de produto/UX)
const MOCK_META = {
  projeto: 'APP Saude',
  ambiente: 'mock',
  versao: '1.1.0',
  dataReferencia: '2024-01-25',
  observacao: 'Dados não reais. Uso exclusivo para prototipação e análise.'
};

/**
 * Amostras de FC ao longo de uma sessão (relógio): offset em segundos desde o início.
 * Usado em exercicioSessao.amostras para o gráfico do detalhe.
 */
function gerarAmostrasFreqCardiacaDemo(duracaoSegundos, nPontos) {
  const n = nPontos == null ? 40 : nPontos;
  const out = [];
  for (let i = 0; i <= n; i++) {
    const offsetSec = Math.round((i / n) * duracaoSegundos);
    const p = i / n;
    let bpm = Math.round(96 + Math.sin(p * Math.PI * 4) * 20 + p * 32);
    if (p > 0.82) bpm += 14;
    bpm = Math.min(149, Math.max(88, bpm));
    out.push({ offsetSec, bpm });
  }
  return out;
}

const mockData = {
  meta: MOCK_META,
  usuario: {
    id: '1',
    tipo: 'paciente',
    nome: 'Maria Silva',
    email: 'joao@email.com',
    cpf: '123.456.789-00',
    dataNascimento: '1985-05-15',
    telefone: '(11) 98765-4321',
    /** Emoji ou texto curto; se `fotoPerfilUrl` for data:image/…, o header usa a foto. */
    fotoPerfil: '👤',
    fotoPerfilUrl: 'Foto_Paciente.jpeg',
    dataCadastro: '2024-01-01',
    ativo: true
  },

  // Catálogo de Medicamentos (pré-cadastrados)
  catalogoMedicamentos: [
    { id: 1, nome: 'Dipirona', formas: ['comprimido', 'gotas'], dosagens: ['500mg', '1000mg', '20 gotas', '1 comprimido'], foto: '💊' },
    { id: 2, nome: 'Losartana', formas: ['comprimido'], dosagens: ['25mg', '50mg', '100mg', '1 comprimido'], foto: '💊' },
    { id: 3, nome: 'Metformina', formas: ['comprimido'], dosagens: ['500mg', '850mg', '1000mg', '1 comprimido'], foto: '💊' },
    { id: 4, nome: 'Atorvastatina', formas: ['comprimido'], dosagens: ['10mg', '20mg', '40mg', '1 comprimido'], foto: '💊' },
    { id: 5, nome: 'Omeprazol', formas: ['capsula'], dosagens: ['20mg', '40mg', '1 capsula'], foto: '💊' },
    { id: 6, nome: 'Diazepam', formas: ['comprimido', 'gotas'], dosagens: ['5mg', '10mg', '5 gotas'], foto: '💊' },
    { id: 7, nome: 'Amoxicilina', formas: ['capsula', 'solucao'], dosagens: ['250mg', '500mg', '5ml', '1 capsula'], foto: '💊' },
    { id: 8, nome: 'Ibuprofeno', formas: ['comprimido', 'solucao'], dosagens: ['200mg', '400mg', '600mg', '5ml'], foto: '💊' },
    { id: 9, nome: 'Paracetamol', formas: ['comprimido', 'gotas', 'solucao'], dosagens: ['500mg', '750mg', '200mg/ml', '15 gotas'], foto: '💊' },
    { id: 10, nome: 'AAS', formas: ['comprimido'], dosagens: ['100mg', '300mg', '1 comprimido'], foto: '💊' },
    { id: 11, nome: 'Levotiroxina', formas: ['comprimido'], dosagens: ['25mcg', '50mcg', '75mcg', '100mcg'], foto: '💊' },
    { id: 12, nome: 'Sinvastatina', formas: ['comprimido'], dosagens: ['10mg', '20mg', '40mg', '1 comprimido'], foto: '💊' },
    { id: 13, nome: 'Anlodipino', formas: ['comprimido'], dosagens: ['5mg', '10mg', '1 comprimido'], foto: '💊' },
    { id: 14, nome: 'Hidroclorotiazida', formas: ['comprimido'], dosagens: ['12.5mg', '25mg', '1 comprimido'], foto: '💊' },
    { id: 15, nome: 'Furosemida', formas: ['comprimido'], dosagens: ['20mg', '40mg', '1 comprimido'], foto: '💊' },
    { id: 16, nome: 'Prednisona', formas: ['comprimido'], dosagens: ['5mg', '20mg', '1 comprimido'], foto: '💊' },
    { id: 17, nome: 'Loratadina', formas: ['comprimido', 'xarope'], dosagens: ['10mg', '5ml', '10ml', '1 comprimido'], foto: '💊' },
    { id: 18, nome: 'Cetirizina', formas: ['comprimido', 'gotas'], dosagens: ['10mg', '10 gotas', '20 gotas'], foto: '💊' },
    { id: 19, nome: 'Nimesulida', formas: ['comprimido', 'solucao'], dosagens: ['100mg', '50mg/ml', '1 comprimido'], foto: '💊' },
    { id: 20, nome: 'Ranitidina', formas: ['comprimido', 'solucao'], dosagens: ['150mg', '300mg', '10ml'], foto: '💊' },
    { id: 21, nome: 'Pantoprazol', formas: ['comprimido'], dosagens: ['20mg', '40mg', '1 comprimido'], foto: '💊' },
    { id: 22, nome: 'Azitromicina', formas: ['comprimido', 'solucao'], dosagens: ['500mg', '40mg/ml', '5ml'], foto: '💊' },
    { id: 23, nome: 'Clavulin', formas: ['comprimido', 'solucao'], dosagens: ['500mg + 125mg', '875mg + 125mg', '5ml'], foto: '💊' },
    { id: 24, nome: 'Insulina NPH', formas: ['injetavel'], dosagens: ['10 UI', '20 UI', '30 UI', '1 unidade'], foto: '💉' },
    { id: 25, nome: 'Salbutamol', formas: ['spray', 'solucao'], dosagens: ['100mcg/jato', '2 jatos', '5ml'], foto: '💨' },
    { id: 26, nome: 'Vitamina D', formas: ['capsula', 'gotas'], dosagens: ['1000 UI', '7000 UI', '1 capsula'], foto: '💊' },
    { id: 27, nome: 'Complexo B', formas: ['capsula', 'comprimido', 'solucao'], dosagens: ['1 capsula', '2 comprimidos', '5ml'], foto: '💊' },
    { id: 28, nome: 'Xarope para Tosse', formas: ['xarope', 'colher'], dosagens: ['5ml', '10ml', '1 colher de cha', '1 colher de sopa'], foto: '🥄' },
    { id: 29, nome: 'Lactulose', formas: ['xarope', 'colher'], dosagens: ['10ml', '15ml', '1 colher de sopa'], foto: '🥄' },
    { id: 30, nome: 'Soro Fisiologico', formas: ['solucao', 'gotas', 'unidade'], dosagens: ['5ml', '10ml', '20 gotas', '1 unidade'], foto: '💧' }
  ],

  /** Onde registrar pressão: Manual, Pulseira, Google Fit, Apple Health (definido em Perfil) */
  configColetaPressao: {
    fonte: 'Manual'
  },

  // Configuração de sinais vitais (ativo/inativo e valores ideais)
  configSinaisVitais: {
    'Batimento Cardíaco':      { exibirSaude: true,  exibirDashboard: true  },
    'Pressão Arterial':        { exibirSaude: true,  exibirDashboard: true  },
    'Temperatura':             { exibirSaude: true,  exibirDashboard: false },
    'Passos':                  { exibirSaude: true,  exibirDashboard: true  },
    'Oxigenação':             { exibirSaude: true,  exibirDashboard: true  },
    'Calorias':                { exibirSaude: true,  exibirDashboard: false },
    'Glicemia':                { exibirSaude: true,  exibirDashboard: true  },
    'HRV':                     { exibirSaude: true,  exibirDashboard: false },
    'Nível de Estresse':       { exibirSaude: true,  exibirDashboard: true  },
    'Sono':                    { exibirSaude: true,  exibirDashboard: true  },
    'Hidratação':             { exibirSaude: true,  exibirDashboard: false },
    'Freq. Respiratória':     { exibirSaude: true,  exibirDashboard: false }
  },

  sinaisVitais: [
    { 
      id: 1, 
      tipo: 'Batimento Cardíaco', 
      valor: 76, 
      unidade: 'bpm', 
      ideal: '50-100', 
      fonte: 'Pulseira', 
      tempo: 'Há 2 horas', 
      categoria: 'saude', 
      status: 'normal', 
      dataHora: '25/01/2024 19:00', 
      icon: '🫀',
      variacao: 'normal',
      tendencia: 'up',
      percentualVariacao: 5,
      historico: [
        {
          data: '2024-01-25',
          hora: '19:00',
          valor: 76,
          status: 'normal',
          anterior: 78,
          fonteColeta: 'Pulseira'
        },
        {
          data: '2024-01-25',
          hora: '08:05',
          valor: 118,
          status: 'normal',
          anterior: 75,
          contextoColeta: 'exercicio',
          fonteColeta: 'Pulseira',
          exercicioSessao: {
            nomeAtividade: 'Aparelhos musculação',
            inicioISO: '2024-01-25T07:00:00',
            fimISO: '2024-01-25T08:02:20',
            duracaoSegundos: 3740,
            caloriasKcal: 492,
            freqMedia: 118,
            freqMax: 149,
            amostras: gerarAmostrasFreqCardiacaDemo(3740, 42)
          }
        },
        {
          data: '2024-01-25',
          hora: '06:45',
          valor: 62,
          status: 'normal',
          anterior: 70,
          contextoColeta: 'repouso',
          fonteColeta: 'Pulseira'
        },
        { data: '2024-01-25', hora: '10:00', valor: 75, status: 'normal', anterior: 72 },
        { data: '2024-01-24', hora: '15:00', valor: 82, status: 'normal', anterior: 78 },
        { data: '2024-01-24', hora: '09:00', valor: 76, status: 'normal', anterior: 80 },
        { data: '2024-01-23', hora: '14:00', valor: 80, status: 'normal', anterior: 77 }
      ]
    },
    { 
      id: 2, 
      tipo: 'Pressão Arterial', 
      valor: '125/82', 
      unidade: 'mmHg', 
      ideal: '120/80', 
      fonte: 'Manual', 
      tempo: 'Há 4 horas', 
      categoria: 'saude', 
      status: 'normal', 
      dataHora: '25/01/2024 12:15', 
      icon: '🩸',
      variacao: 'ligeiramente_alta',
      tendencia: 'up',
      percentualVariacao: 3,
      alerta: { ativo: true, acima: 140, abaixo: 90 },
      historico: [
        { data: '2024-01-25', hora: '12:15', valor: '125/82', status: 'ligeiramente_alta', anterior: '120/80' },
        { data: '2024-01-25', hora: '08:00', valor: '120/80', status: 'normal', anterior: '118/79' },
        { data: '2024-01-24', hora: '14:00', valor: '122/81', status: 'normal', anterior: '120/80' },
        { data: '2024-01-24', hora: '09:00', valor: '118/79', status: 'normal', anterior: '120/81' },
        { data: '2024-01-23', hora: '15:00', valor: '128/85', status: 'ligeiramente_alta', anterior: '125/82' }
      ]
    },
    { 
      id: 3, 
      tipo: 'Temperatura', 
      valor: 36.8, 
      unidade: '°C', 
      ideal: '36-37.5', 
      fonte: 'Manual', 
      tempo: 'Há 1 hora', 
      categoria: 'saude', 
      status: 'normal', 
      dataHora: '25/01/2024 15:45', 
      icon: '🌡️',
      variacao: 'normal',
      tendencia: 'down',
      percentualVariacao: -2,
      historico: [
        { data: '2024-01-25', hora: '15:45', valor: 36.8, status: 'normal', anterior: 36.9 },
        { data: '2024-01-25', hora: '09:00', valor: 36.5, status: 'normal', anterior: 36.8 },
        { data: '2024-01-24', hora: '14:00', valor: 36.9, status: 'normal', anterior: 36.7 },
        { data: '2024-01-24', hora: '08:00', valor: 36.7, status: 'normal', anterior: 36.9 },
        { data: '2024-01-23', hora: '15:00', valor: 37.0, status: 'normal', anterior: 36.8 }
      ]
    },
    { 
      id: 4, 
      tipo: 'Passos', 
      valor: 8234, 
      unidade: 'passos', 
      ideal: '5000-15000', 
      fonte: 'Google Fit', 
      tempo: 'Hoje', 
      categoria: 'saude', 
      status: 'normal', 
      dataHora: '25/01/2024 23:59', 
      icon: '👟',
      variacao: 'normal',
      tendencia: 'up',
      percentualVariacao: 8,
      historico: [
        { data: '2024-01-25', valor: 8234, status: 'normal', anterior: 7600 },
        { data: '2024-01-24', valor: 9500, status: 'normal', anterior: 8900 },
        { data: '2024-01-23', valor: 7200, status: 'normal', anterior: 8100 },
        { data: '2024-01-22', valor: 10500, status: 'normal', anterior: 9200 },
        { data: '2024-01-21', valor: 6800, status: 'normal', anterior: 7500 }
      ]
    },
    { 
      id: 5, 
      tipo: 'Oxigenação', 
      valor: 98, 
      unidade: '%', 
      ideal: '95-100', 
      fonte: 'Pulseira', 
      tempo: 'Há 30 min', 
      categoria: 'saude', 
      status: 'normal', 
      dataHora: '25/01/2024 16:00', 
      icon: '💨',
      variacao: 'normal',
      tendencia: 'up',
      percentualVariacao: 1,
      historico: [
        { data: '2024-01-25', hora: '16:00', valor: 98, status: 'normal', anterior: 97 },
        { data: '2024-01-25', hora: '10:00', valor: 97, status: 'normal', anterior: 96 },
        { data: '2024-01-24', hora: '15:00', valor: 99, status: 'normal', anterior: 98 },
        { data: '2024-01-24', hora: '09:00', valor: 96, status: 'normal', anterior: 97 },
        { data: '2024-01-23', hora: '14:00', valor: 98, status: 'normal', anterior: 99 }
      ]
    },
    { 
      id: 6, 
      tipo: 'Calorias', 
      valor: 2100, 
      unidade: 'kcal', 
      ideal: '1800-2500', 
      fonte: 'Google Fit', 
      tempo: 'Hoje', 
      categoria: 'saude', 
      status: 'normal', 
      dataHora: '25/01/2024 23:59', 
      icon: '🔥',
      variacao: 'normal',
      tendencia: 'down',
      percentualVariacao: -5,
      historico: [
        { data: '2024-01-25', valor: 2100, status: 'normal', anterior: 2200 },
        { data: '2024-01-24', valor: 2300, status: 'normal', anterior: 2100 },
        { data: '2024-01-23', valor: 1900, status: 'normal', anterior: 2300 },
        { data: '2024-01-22', valor: 2200, status: 'normal', anterior: 1900 },
        { data: '2024-01-21', valor: 2050, status: 'normal', anterior: 2200 }
      ]
    },
    {
      id: 7,
      tipo: 'Glicemia',
      valor: 94,
      unidade: 'mg/dL',
      ideal: '70-99',
      fonte: 'Manual',
      tempo: 'Hoje',
      categoria: 'saude',
      status: 'normal',
      dataHora: '25/01/2024 07:30',
      icon: '🩺',
      variacao: 'normal',
      tendencia: 'down',
      percentualVariacao: -2,
      alerta: { ativo: true, acima: 126, abaixo: 70 },
      historico: [
        { data: '2024-01-25', hora: '07:30', valor: 94, status: 'normal', anterior: 96 },
        { data: '2024-01-24', hora: '07:15', valor: 96, status: 'normal', anterior: 98 },
        { data: '2024-01-23', hora: '07:45', valor: 102, status: 'atencao', anterior: 96 },
        { data: '2024-01-22', hora: '07:30', valor: 98, status: 'normal', anterior: 95 },
        { data: '2024-01-21', hora: '07:20', valor: 95, status: 'normal', anterior: 97 }
      ]
    },
    {
      id: 8,
      tipo: 'HRV',
      valor: 52,
      unidade: 'ms',
      ideal: '40-80',
      fonte: 'Pulseira',
      tempo: 'Esta manhã',
      categoria: 'saude',
      status: 'normal',
      dataHora: '25/01/2024 06:00',
      icon: '💓',
      variacao: 'normal',
      tendencia: 'up',
      percentualVariacao: 4,
      historico: [
        { data: '2024-01-25', hora: '06:00', valor: 52, status: 'normal', anterior: 50 },
        { data: '2024-01-24', hora: '06:00', valor: 50, status: 'normal', anterior: 48 },
        { data: '2024-01-23', hora: '06:00', valor: 45, status: 'normal', anterior: 50 },
        { data: '2024-01-22', hora: '06:00', valor: 48, status: 'normal', anterior: 46 },
        { data: '2024-01-21', hora: '06:00', valor: 46, status: 'normal', anterior: 49 }
      ]
    },
    {
      id: 9,
      tipo: 'Nível de Estresse',
      valor: 38,
      unidade: '%',
      ideal: '0-40',
      fonte: 'Pulseira',
      tempo: 'Há 1 hora',
      categoria: 'saude',
      status: 'normal',
      dataHora: '25/01/2024 15:00',
      icon: '🧠',
      variacao: 'normal',
      tendencia: 'down',
      percentualVariacao: -5,
      historico: [
        { data: '2024-01-25', hora: '15:00', valor: 38, status: 'normal', anterior: 43 },
        { data: '2024-01-25', hora: '12:00', valor: 43, status: 'atencao', anterior: 35 },
        { data: '2024-01-24', hora: '15:00', valor: 35, status: 'normal', anterior: 40 },
        { data: '2024-01-24', hora: '12:00', valor: 40, status: 'normal', anterior: 38 },
        { data: '2024-01-23', hora: '15:00', valor: 55, status: 'atencao', anterior: 42 }
      ]
    },
    {
      id: 10,
      tipo: 'Sono',
      valor: 7.2,
      unidade: 'h',
      ideal: '7-9',
      fonte: 'Apple Health',
      tempo: 'Ontem',
      categoria: 'saude',
      status: 'normal',
      dataHora: '24/01/2024 06:30',
      icon: '😴',
      variacao: 'normal',
      tendencia: 'up',
      percentualVariacao: 3,
      historico: [
        { data: '2024-01-24', valor: 7.2, status: 'normal', anterior: 6.8 },
        { data: '2024-01-23', valor: 6.8, status: 'atencao', anterior: 7.5 },
        { data: '2024-01-22', valor: 7.5, status: 'normal', anterior: 7.0 },
        { data: '2024-01-21', valor: 7.0, status: 'normal', anterior: 6.5 },
        { data: '2024-01-20', valor: 6.5, status: 'atencao', anterior: 7.2 }
      ]
    },
    {
      id: 11,
      tipo: 'Hidratação',
      valor: 1800,
      unidade: 'ml',
      ideal: '2000-3000',
      fonte: 'Manual',
      tempo: 'Hoje',
      categoria: 'saude',
      status: 'atencao',
      dataHora: '25/01/2024 16:00',
      icon: '💧',
      variacao: 'abaixo',
      tendencia: 'up',
      percentualVariacao: 10,
      historico: [
        { data: '2024-01-25', valor: 1800, status: 'atencao', anterior: 1600 },
        { data: '2024-01-24', valor: 2200, status: 'normal', anterior: 1900 },
        { data: '2024-01-23', valor: 1600, status: 'atencao', anterior: 2100 },
        { data: '2024-01-22', valor: 2400, status: 'normal', anterior: 2200 },
        { data: '2024-01-21', valor: 1900, status: 'atencao', anterior: 2300 }
      ]
    },
    {
      id: 12,
      tipo: 'Freq. Respiratória',
      valor: 16,
      unidade: 'rpm',
      ideal: '12-20',
      fonte: 'Pulseira',
      tempo: 'Há 2 horas',
      categoria: 'saude',
      status: 'normal',
      dataHora: '25/01/2024 14:00',
      icon: '🫁',
      variacao: 'normal',
      tendencia: 'down',
      percentualVariacao: -1,
      historico: [
        { data: '2024-01-25', hora: '14:00', valor: 16, status: 'normal', anterior: 17 },
        { data: '2024-01-25', hora: '08:00', valor: 17, status: 'normal', anterior: 16 },
        { data: '2024-01-24', hora: '14:00', valor: 15, status: 'normal', anterior: 16 },
        { data: '2024-01-24', hora: '08:00', valor: 16, status: 'normal', anterior: 15 },
        { data: '2024-01-23', hora: '14:00', valor: 18, status: 'normal', anterior: 16 }
      ]
    }
  ],

  // Configuração de composição corporal
  configComposicao: {
    'Peso':                    { exibirCorpo: true,  exibirDashboard: true  },
    'Altura':                  { exibirCorpo: true,  exibirDashboard: false },
    'IMC':                     { exibirCorpo: true,  exibirDashboard: true  },
    'Percentual de Gordura':   { exibirCorpo: true,  exibirDashboard: false },
    'Massa Muscular':          { exibirCorpo: true,  exibirDashboard: false },
    'Circunferência Cintura':  { exibirCorpo: true,  exibirDashboard: false }
  },

  // Composição Corporal
  composicaoCorporal: [
    {
      id: 1,
      tipo: 'Peso',
      valor: 75,
      unidade: 'kg',
      ideal: 70,
      dataHora: '25/01/2024',
      variacao: 'acima',
      icon: '⚖️',
      fonte: 'Balança Inteligente',
      historico: [
        { data: '2024-01-25', valor: 75, variacao: 'acima', fonte: 'Balança Inteligente' },
        { data: '2024-01-24', valor: 74.8, variacao: 'acima', fonte: 'Balança Inteligente' },
        { data: '2024-01-23', valor: 74.5, variacao: 'acima', fonte: 'Balança Inteligente' },
        { data: '2024-01-22', valor: 74.2, variacao: 'acima', fonte: 'Balança Inteligente' },
        { data: '2024-01-21', valor: 73.9, variacao: 'acima', fonte: 'Balança Inteligente' }
      ]
    },
    {
      id: 2,
      tipo: 'Altura',
      valor: 1.78,
      unidade: 'm',
      ideal: 1.78,
      dataHora: '15/01/2024',
      variacao: 'normal',
      icon: '📏',
      fonte: 'Manual',
      historico: []
    },
    {
      id: 3,
      tipo: 'IMC',
      valor: 23.7,
      unidade: 'kg/m²',
      ideal: '18.5-24.9',
      dataHora: '25/01/2024',
      variacao: 'normal',
      icon: '📊',
      fonte: 'Calculado',
      historico: [
        { data: '2024-01-25', valor: 23.7, variacao: 'normal', fonte: 'Calculado' },
        { data: '2024-01-24', valor: 23.6, variacao: 'normal', fonte: 'Calculado' },
        { data: '2024-01-23', valor: 23.5, variacao: 'normal', fonte: 'Calculado' },
        { data: '2024-01-22', valor: 23.4, variacao: 'normal', fonte: 'Calculado' },
        { data: '2024-01-21', valor: 23.3, variacao: 'normal', fonte: 'Calculado' }
      ]
    },
    {
      id: 4,
      tipo: 'Percentual de Gordura',
      valor: 22,
      unidade: '%',
      ideal: '15-25',
      dataHora: '20/01/2024',
      variacao: 'normal',
      icon: '🔴',
      fonte: 'Balança Inteligente',
      historico: [
        { data: '2024-01-20', valor: 22, variacao: 'normal', fonte: 'Balança Inteligente' },
        { data: '2024-01-15', valor: 22.5, variacao: 'normal', fonte: 'Balança Inteligente' },
        { data: '2024-01-10', valor: 23, variacao: 'normal', fonte: 'Balança Inteligente' }
      ]
    },
    {
      id: 5,
      tipo: 'Massa Muscular',
      valor: 58,
      unidade: 'kg',
      ideal: '55-65',
      dataHora: '20/01/2024',
      variacao: 'normal',
      icon: '💪',
      fonte: 'Balança Inteligente',
      historico: [
        { data: '2024-01-20', valor: 58, variacao: 'normal', fonte: 'Balança Inteligente' },
        { data: '2024-01-15', valor: 57.8, variacao: 'normal', fonte: 'Balança Inteligente' },
        { data: '2024-01-10', valor: 57.5, variacao: 'normal', fonte: 'Balança Inteligente' }
      ]
    },
    {
      id: 6,
      tipo: 'Circunferência Cintura',
      valor: 82,
      unidade: 'cm',
      ideal: '< 94',
      dataHora: '20/01/2024',
      variacao: 'normal',
      icon: '📐',
      fonte: 'Manual',
      historico: [
        { data: '2024-01-20', valor: 82, variacao: 'normal', fonte: 'Manual' },
        { data: '2024-01-15', valor: 81.5, variacao: 'normal', fonte: 'Manual' },
        { data: '2024-01-10', valor: 81, variacao: 'normal', fonte: 'Manual' }
      ]
    }
  ],

  // ECG
  ecgs: [
    {
      id: 1,
      frequenciaCardiaca: 72,
      ritmo: 'Normal',
      interpretacao: 'Normal - Sem alterações detectadas',
      dataHora: '25/01/2024 10:00',
      arquivo: 'ecg_25_01_2024.pdf',
      status: 'normal',
      icon: '📈',
      historico: [
        { data: '2024-01-25', hora: '10:00', frequencia: 72, ritmo: 'Normal', interpretacao: 'Normal - Sem alterações detectadas' },
        { data: '2024-01-20', hora: '09:30', frequencia: 75, ritmo: 'Normal', interpretacao: 'Normal - Sem alterações detectadas' },
        { data: '2024-01-15', hora: '14:00', frequencia: 70, ritmo: 'Normal', interpretacao: 'Normal - Sem alterações detectadas' },
        { data: '2024-01-10', hora: '11:00', frequencia: 73, ritmo: 'Normal', interpretacao: 'Normal - Sem alterações detectadas' },
        { data: '2024-01-05', hora: '15:30', frequencia: 71, ritmo: 'Normal', interpretacao: 'Normal - Sem alterações detectadas' }
      ]
    }
  ],

  medicacoes: [
    { 
      id: 1, 
      nome: 'Dipirona', 
      dosagem: '500mg', 
      horarios: ['08:00', '14:30', '20:00'],
      frequencia: '3x ao dia',
      dataInicio: '2024-01-15',
      dataFim: '2024-02-15',
      estoqueAtual: 18,
      estoqueMinimo: 7,
      exibirDashboard: true,
      alertas: { lembrete: true, antecedencia: 10, atrasada: true, estoqueBaixo: true },
      categoria: 'medicacao',
      historico: []
    },
    { 
      id: 2, 
      nome: 'Losartana', 
      dosagem: '50mg', 
      horarios: ['08:00'],
      frequencia: '1x ao dia',
      dataInicio: '2024-01-01',
      dataFim: '2024-12-31',
      estoqueAtual: 25,
      estoqueMinimo: 5,
      exibirDashboard: true,
      alertas: { lembrete: true, antecedencia: 10, atrasada: true, estoqueBaixo: true },
      categoria: 'medicacao',
      historico: []
    },
    { 
      id: 3, 
      nome: 'Metformina', 
      dosagem: '850mg', 
      horarios: ['08:00', '20:00'],
      frequencia: '2x ao dia',
      dataInicio: '2024-01-10',
      dataFim: '2024-03-10',
      estoqueAtual: 40,
      estoqueMinimo: 10,
      exibirDashboard: false,
      alertas: { lembrete: true, antecedencia: 15, atrasada: false, estoqueBaixo: true },
      categoria: 'medicacao',
      historico: []
    },
    { 
      id: 4, 
      nome: 'Atorvastatina', 
      dosagem: '20mg', 
      horarios: ['20:00'],
      frequencia: '1x ao dia',
      dataInicio: '2024-01-01',
      dataFim: '2024-12-31',
      estoqueAtual: 6,
      estoqueMinimo: 5,
      exibirDashboard: false,
      alertas: { lembrete: true, antecedencia: 10, atrasada: true, estoqueBaixo: true },
      categoria: 'medicacao',
      historico: []
    },
    { 
      id: 5, 
      nome: 'Omeprazol', 
      dosagem: '20mg', 
      horarios: ['07:00'],
      frequencia: '1x ao dia',
      dataInicio: '2024-01-05',
      dataFim: '2024-02-05',
      estoqueAtual: 4,
      estoqueMinimo: 7,
      exibirDashboard: true,
      alertas: { lembrete: true, antecedencia: 10, atrasada: true, estoqueBaixo: true },
      categoria: 'medicacao',
      historico: []
    }
  ],

  consultas: [
    { 
      id: 1, 
      medico: 'Dr. Carlos Costa', 
      especialidade: 'Cardiologia', 
      data: '10/02/2024', 
      hora: '14:30',
      tipo: 'Presencial', 
      status: 'Agendado',
      local: 'Clínica Central',
      motivo: 'Acompanhamento cardíaco',
      categoria: 'agenda',
      alerta: { ativo: true, antecedencia: 1440 }
    },
    { 
      id: 2, 
      medico: 'Dra. Ana Santos', 
      especialidade: 'Clínica Geral', 
      data: '15/02/2024', 
      hora: '10:00', 
      tipo: 'Online', 
      status: 'Agendado',
      local: 'Telemedicina',
      motivo: 'Consulta de rotina',
      categoria: 'agenda',
      alerta: { ativo: true, antecedencia: 120 }
    }
  ],

  examesAgendados: [
    { 
      id: 1, 
      nome: 'Hemograma Completo', 
      data: '05/02/2024', 
      local: 'Laboratório ABC', 
      medico: 'Dr. Carlos Silva', 
      status: 'Agendado',
      categoria: 'agenda'
    },
    { 
      id: 2, 
      nome: 'Eletrocardiograma', 
      data: '12/02/2024', 
      local: 'Clínica Central', 
      medico: 'Dr. Carlos Silva', 
      status: 'Agendado',
      categoria: 'agenda'
    }
  ],

  examesRealizados: [
    { 
      id: 1, 
      nome: 'Hemograma Completo', 
      data: '28/01/2024', 
      local: 'Laboratório ABC', 
      resultado: 'Resultado normal. Todos os valores dentro dos limites esperados.',
      categoria: 'agenda'
    },
    { 
      id: 2, 
      nome: 'Eletrocardiograma', 
      data: '20/01/2024', 
      local: 'Clínica Central', 
      resultado: 'Ritmo cardíaco normal. Sem alterações detectadas.',
      categoria: 'agenda'
    }
  ],

  compartilhamentos: [
    {
      id: 1,
      medico: 'Dr. Carlos Silva',
      especialidade: 'Cardiologia',
      dadosCompartilhados: ['sinais_vitais', 'medicacoes', 'exames'],
      dataAutorizacao: '2024-01-15',
      ativo: true
    }
  ],

  // Catálogo de tipos de dispositivos e o que cada um pode coletar
  catalogoDispositivos: [
    {
      tipo: 'Relógio / Pulseira',
      icon: '⌚',
      sinaisDisponiveis: ['Batimento Cardíaco', 'Pressão Arterial', 'Oxigenação', 'Passos', 'Calorias', 'Sono', 'HRV', 'Nível de Estresse', 'Freq. Respiratória']
    },
    {
      tipo: 'Balança Inteligente',
      icon: '⚖️',
      sinaisDisponiveis: ['Peso', 'IMC', 'Percentual de Gordura', 'Massa Muscular', 'Hidratação']
    },
    {
      tipo: 'Glicosímetro',
      icon: '🩺',
      sinaisDisponiveis: ['Glicemia']
    },
    {
      tipo: 'Termômetro',
      icon: '🌡️',
      sinaisDisponiveis: ['Temperatura']
    },
    {
      tipo: 'Esfigmomanômetro',
      icon: '🩺',
      sinaisDisponiveis: ['Pressão Arterial', 'Batimento Cardíaco']
    },
    {
      tipo: 'App / Plataforma',
      icon: '📱',
      sinaisDisponiveis: ['Passos', 'Calorias', 'Sono', 'Hidratação', 'Batimento Cardíaco', 'Peso']
    }
  ],

  dispositivos: [
    {
      id: 1,
      nome: 'Apple Watch Series 9',
      tipo: 'Relógio / Pulseira',
      icon: '⌚',
      conectado: true,
      sinaisColetados: ['Batimento Cardíaco', 'Oxigenação', 'Passos', 'Calorias', 'Sono', 'HRV', 'Nível de Estresse']
    },
    {
      id: 2,
      nome: 'Balança Xiaomi Mi',
      tipo: 'Balança Inteligente',
      icon: '⚖️',
      conectado: true,
      sinaisColetados: ['Peso', 'IMC', 'Percentual de Gordura', 'Massa Muscular']
    },
    {
      id: 3,
      nome: 'Google Fit',
      tipo: 'App / Plataforma',
      icon: '📱',
      conectado: true,
      sinaisColetados: ['Passos', 'Calorias', 'Sono']
    }
  ]
};

// Cores por categoria - Paleta Padrão do Projeto
const categoryColors = {
  medicacao: {
    primary: '#6e6e6e',
    light: '#ececec',
    border: '#9e9e9e',
    icon: '💊'
  },
  saude: {
    primary: '#6e6e6e',
    light: '#ececec',
    border: '#9e9e9e',
    icon: '❤️'
  },
  agenda: {
    primary: '#6e6e6e',
    light: '#ececec',
    border: '#9e9e9e',
    icon: '📅'
  }
};

// Status colors (tons neutros — leitura)
const statusColors = {
  normal: '#5a5a5a',
  atencao: '#6e6e6e',
  aviso: '#7a7a7a',
  critico: '#454545'
};

// =========================
// Normalização para análise
// =========================
function toISODate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  // Formato já ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // Formato BR: DD/MM/YYYY
  const br = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

function toISODateTime(dateStr, timeStr) {
  const isoDate = toISODate(dateStr);
  if (!isoDate) return null;
  if (!timeStr) return `${isoDate}T00:00:00`;
  return `${isoDate}T${timeStr}:00`;
}

/** Último dia do tratamento: início + (duracaoDias - 1) dias corridos (calendário local). */
function computeDataFimFromInicioDuracao(dataInicioISO, duracaoDias) {
  if (!dataInicioISO || duracaoDias == null || duracaoDias < 1) return '';
  const parts = dataInicioISO.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return '';
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + duracaoDias - 1);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function inferDuracaoDiasFromInicioFim(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return null;
  const pa = dataInicio.split('-').map(Number);
  const pb = dataFim.split('-').map(Number);
  if (pa.length !== 3 || pb.length !== 3) return null;
  const a = new Date(pa[0], pa[1] - 1, pa[2]);
  const b = new Date(pb[0], pb[1] - 1, pb[2]);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const diff = Math.round((b - a) / 86400000) + 1;
  return diff > 0 ? diff : null;
}

function parseIdealObject(ideal) {
  if (ideal == null) return null;
  if (typeof ideal === 'object' && ideal.label) return ideal;
  if (typeof ideal === 'number') {
    return { type: 'target', target: ideal, min: ideal, max: ideal, label: String(ideal) };
  }
  if (typeof ideal !== 'string') return { type: 'raw', label: String(ideal) };

  const pressure = ideal.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (pressure) {
    const sistolica = parseInt(pressure[1], 10);
    const diastolica = parseInt(pressure[2], 10);
    return {
      type: 'pressure',
      systolic: sistolica,
      diastolic: diastolica,
      label: `${sistolica}/${diastolica}`
    };
  }

  const range = ideal.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
  if (range) {
    const min = parseFloat(range[1]);
    const max = parseFloat(range[2]);
    return { type: 'range', min, max, label: `${min}-${max}` };
  }

  const lt = ideal.match(/^<\s*(-?\d+(?:\.\d+)?)$/);
  if (lt) {
    const max = parseFloat(lt[1]);
    return { type: 'max', min: null, max, label: `< ${max}` };
  }

  const gt = ideal.match(/^>\s*(-?\d+(?:\.\d+)?)$/);
  if (gt) {
    const min = parseFloat(gt[1]);
    return { type: 'min', min, max: null, label: `> ${min}` };
  }

  return { type: 'raw', label: ideal };
}

function parsePressureValue(value) {
  if (!value) return null;
  if (typeof value === 'object' && value.sistolica != null && value.diastolica != null) return value;
  if (typeof value !== 'string') return null;
  const parts = value.split('/');
  if (parts.length !== 2) return null;
  const sistolica = parseInt(parts[0], 10);
  const diastolica = parseInt(parts[1], 10);
  if (Number.isNaN(sistolica) || Number.isNaN(diastolica)) return null;
  return { sistolica, diastolica };
}

function formatIdealLabel(ideal) {
  if (!ideal) return '-';
  if (typeof ideal === 'string') return ideal;
  if (ideal.label) return ideal.label;
  if (ideal.type === 'pressure') return `${ideal.systolic}/${ideal.diastolic}`;
  if (ideal.min != null && ideal.max != null) return `${ideal.min}-${ideal.max}`;
  if (ideal.min != null) return `> ${ideal.min}`;
  if (ideal.max != null) return `< ${ideal.max}`;
  if (ideal.target != null) return String(ideal.target);
  return '-';
}

function formatVitalValue(vital) {
  if (!vital) return '-';
  if (vital.tipo === 'Pressão Arterial' && vital.valor && typeof vital.valor === 'object') {
    return `${vital.valor.sistolica}/${vital.valor.diastolica}`;
  }
  return String(vital.valor ?? '-');
}

function formatHistoricValue(vitalTipo, historicoItem) {
  if (vitalTipo === 'Pressão Arterial' && historicoItem && typeof historicoItem.valor === 'object') {
    return `${historicoItem.valor.sistolica}/${historicoItem.valor.diastolica}`;
  }
  return String(historicoItem?.valor ?? '-');
}

/** Tag curta no histórico: repouso / exercício (omitido em situação habitual). */
function getLabelContextoColetaHistorico(entry) {
  const c = entry && entry.contextoColeta;
  if (!c || c === 'normal') return '';
  if (c === 'repouso') return 'Repouso';
  if (c === 'exercicio') return 'Exercício';
  if (c === 'sono') return 'Sono';
  return '';
}

function historicoEntryToMs(entry) {
  if (!entry || !entry.data) return null;
  const ds = String(entry.data).slice(0, 10);
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ds);
  if (!dm) return null;
  const timePart = entry.hora && String(entry.hora).length >= 4 ? String(entry.hora).slice(0, 5) : '12:00';
  const tm = /^(\d{1,2}):(\d{2})/.exec(timePart);
  const hh = tm ? parseInt(tm[1], 10) : 12;
  const mm = tm ? parseInt(tm[2], 10) : 0;
  const d = new Date(parseInt(dm[1], 10), parseInt(dm[2], 10) - 1, parseInt(dm[3], 10), hh, mm, 0, 0);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

function getHistoricoUltimas24Horas(historico) {
  const now = Date.now();
  const limite = now - 24 * 60 * 60 * 1000;
  return (historico || []).filter((h) => {
    const t = historicoEntryToMs(h);
    return t != null && t >= limite && t <= now + 5 * 60 * 1000;
  });
}

function parseHistoricoPressurePair(h) {
  const v = h && h.valor;
  if (v && typeof v === 'object' && v.sistolica != null && v.diastolica != null) {
    return { s: Number(v.sistolica), d: Number(v.diastolica) };
  }
  if (typeof v === 'string' && typeof parsePressureValue === 'function') {
    const parsed = parsePressureValue(v);
    if (!parsed) return null;
    return { s: Number(parsed.sistolica), d: Number(parsed.diastolica) };
  }
  return null;
}

/** Faixas min–max nas últimas 24 h, separadas por componente (como no card de referência). */
function getVital24hPressureRanges(vital) {
  const historico = getHistoricoUltimas24Horas(vital?.historico);
  const pairs = historico.map(parseHistoricoPressurePair).filter(Boolean);
  if (pairs.length === 0) return null;
  const sList = pairs.map((p) => p.s);
  const dList = pairs.map((p) => p.d);
  const sisMin = Math.min(...sList);
  const sisMax = Math.max(...sList);
  const diaMin = Math.min(...dList);
  const diaMax = Math.max(...dList);
  return {
    sisRange: `${sisMin}-${sisMax}`,
    diaRange: `${diaMin}-${diaMax}`
  };
}

function getVital24hMinMaxStrings(vital) {
  const historico = getHistoricoUltimas24Horas(vital?.historico);
  if (historico.length === 0) return null;
  const tipo = vital && vital.tipo;
  if (tipo === 'Pressão Arterial') return null;
  const nums = historico
    .map((h) => {
      const v = h.valor;
      if (v != null && typeof v === 'object') return null;
      const n = parseFloat(v);
      return Number.isNaN(n) ? null : n;
    })
    .filter((n) => n != null);
  if (nums.length === 0) return null;
  return { maxStr: String(Math.max(...nums)), minStr: String(Math.min(...nums)) };
}

/** Min/max para card de batimento: últimas 24 h; se vazio, usa todo o histórico numérico (fallback p/ demo). */
function getBatimentoMinMaxForCard(vital) {
  if (!vital || vital.tipo !== 'Batimento Cardíaco') return null;
  const mm24 = getVital24hMinMaxStrings(vital);
  if (mm24) return mm24;
  const nums = (vital.historico || [])
    .map((h) => {
      const val = h && h.valor;
      if (val != null && typeof val === 'object') return null;
      const n = parseFloat(val);
      return Number.isNaN(n) ? null : n;
    })
    .filter((n) => n != null);
  if (nums.length === 0) {
    const v = parseFloat(vital.valor);
    if (!Number.isNaN(v)) return { minStr: String(v), maxStr: String(v) };
    return null;
  }
  return { maxStr: String(Math.max(...nums)), minStr: String(Math.min(...nums)) };
}

/**
 * Fundo do "cardizinho" da última medição + min/max: verde / amarelo / vermelho bem claros.
 */
function getBatimentoCardTone(vital) {
  if (!vital || vital.tipo !== 'Batimento Cardíaco') return 'vital-batimento-tone--none';
  const v = parseFloat(vital.valor);
  if (Number.isNaN(v)) return 'vital-batimento-tone--none';
  const ideal = vital.ideal;
  if (!ideal || ideal.type === 'raw') {
    return vital.variacao === 'normal' ? 'vital-batimento-tone--ok' : 'vital-batimento-tone--alert';
  }
  if (ideal.type === 'range' && ideal.min != null && ideal.max != null) {
    const min = ideal.min;
    const max = ideal.max;
    const span = max - min;
    const edge = Math.max(3, Math.min(8, span * 0.08));
    if (v >= min && v <= max) {
      if (v >= min + edge && v <= max - edge) return 'vital-batimento-tone--ok';
      return 'vital-batimento-tone--warn';
    }
    const distOut = v < min ? min - v : v - max;
    if (distOut <= edge * 1.5) return 'vital-batimento-tone--warn';
    return 'vital-batimento-tone--alert';
  }
  if (ideal.type === 'max' && ideal.max != null) {
    if (v <= ideal.max) return v <= ideal.max - 3 ? 'vital-batimento-tone--ok' : 'vital-batimento-tone--warn';
    return v <= ideal.max + 5 ? 'vital-batimento-tone--warn' : 'vital-batimento-tone--alert';
  }
  if (ideal.type === 'min' && ideal.min != null) {
    if (v >= ideal.min) return v >= ideal.min + 3 ? 'vital-batimento-tone--ok' : 'vital-batimento-tone--warn';
    return v >= ideal.min - 5 ? 'vital-batimento-tone--warn' : 'vital-batimento-tone--alert';
  }
  return vital.variacao === 'normal' ? 'vital-batimento-tone--ok' : 'vital-batimento-tone--alert';
}

function formatVital24hRangeLine(vital) {
  if (vital && vital.tipo === 'Pressão Arterial') {
    const pr = getVital24hPressureRanges(vital);
    if (!pr) {
      return `<div class="vital-24h-line vital-24h-line--pressure"><span class="vital-24h-clock" aria-hidden="true">🕐</span><span class="vital-24h-empty">—</span></div>`;
    }
    return `<div class="vital-24h-line vital-24h-line--pressure">
      <span class="vital-24h-clock" aria-hidden="true">🕐</span>
      <span class="vital-24h-pressure-range" aria-label="Faixa nas últimas 24 horas">${pr.sisRange}<span class="vital-24h-p-mid">/</span>${pr.diaRange}</span>
    </div>`;
  }

  const mm = getVital24hMinMaxStrings(vital);
  const u = vital && vital.unidade ? ` ${vital.unidade}` : '';
  if (!mm) {
    return `<div class="vital-24h-line"><span class="vital-24h-clock" aria-hidden="true">🕐</span><span class="vital-24h-empty">—</span></div>`;
  }
  return `<div class="vital-24h-line"><span class="vital-24h-clock" aria-hidden="true">🕐</span><span class="vital-24h-mm">${mm.maxStr}${u} – ${mm.minStr}${u}</span></div>`;
}

function getNumericTrendValue(vitalTipo, historicoItem) {
  if (!historicoItem) return null;
  const v = historicoItem.valor;
  if (vitalTipo === 'Pressão Arterial') {
    const p = parseHistoricoPressurePair(historicoItem);
    if (p) return p.s;
  }
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

function computeTrendDirFromHistoricoSlice(vitalTipo, historicoNewestFirst) {
  if (!historicoNewestFirst || historicoNewestFirst.length < 2) return 'up';
  const chrono = historicoNewestFirst.slice(0, 3).reverse();
  const a = getNumericTrendValue(vitalTipo, chrono[0]);
  const b = getNumericTrendValue(vitalTipo, chrono[chrono.length - 1]);
  if (a == null || b == null) return 'up';
  if (b > a) return 'up';
  if (b < a) return 'down';
  return 'up';
}

/** Remove medições geradas por `injectDemoMedicoesUltimas24h` (para reinjetar com a data de “hoje” correta). */
function stripDemoMedicoesUltimas24h(data) {
  if (!data || !Array.isArray(data.sinaisVitais)) return;
  data.sinaisVitais.forEach((vital) => {
    if (!Array.isArray(vital.historico)) return;
    vital.historico = vital.historico.filter((h) => !h.demoUltimas24h);
  });
}

/**
 * Várias leituras por hora (demo: paginação 5/minuto no modal; faixa mín./máx. coerente).
 * Curva tipo pulseira: noite mais baixa, dia mais alta, variação suave.
 */
function gerarBatimentoDemoPorHora(nowRef, daysBack = 16) {
  const out = [];
  const pad2 = (n) => String(n).padStart(2, '0');
  const minutosPorHora = [4, 12, 22, 32, 42, 52];
  for (let d = 0; d < daysBack; d += 1) {
    const day = new Date(nowRef.getFullYear(), nowRef.getMonth(), nowRef.getDate() - d);
    const dataStr = `${day.getFullYear()}-${pad2(day.getMonth() + 1)}-${pad2(day.getDate())}`;
    for (let hour = 0; hour < 24; hour += 1) {
      const wave = Math.sin(((hour + d * 0.4) / 24) * Math.PI * 2) * 6;
      let lo = 70;
      let hi = 82;
      if (hour >= 0 && hour < 7) {
        lo = 52;
        hi = 66;
      } else if (hour >= 7 && hour < 10) {
        lo = 64;
        hi = 84;
      } else if (hour >= 10 && hour < 18) {
        lo = 72;
        hi = 94;
      } else if (hour >= 18 && hour < 22) {
        lo = 68;
        hi = 88;
      } else {
        lo = 58;
        hi = 78;
      }
      lo = Math.round(lo + wave * 0.35);
      hi = Math.round(hi + wave * 0.35);
      if (hi <= lo + 2) hi = lo + 4;
      const span = hi - lo;
      minutosPorHora.forEach((min, idx) => {
        const t = minutosPorHora.length > 1 ? idx / (minutosPorHora.length - 1) : 0;
        const jitter = ((hour * 3 + idx + d) % 5) - 2;
        let v = Math.round(lo + span * (0.15 + t * 0.7) + jitter * 0.4);
        v = Math.min(hi, Math.max(lo, v));
        out.push({
          data: dataStr,
          hora: `${pad2(hour)}:${pad2(min)}`,
          valor: v,
          status: 'normal',
          demoUltimas24h: true,
          demoPorHora: true
        });
      });
    }
  }
  return out;
}

/** Medições fictícias nas últimas 24 h para demonstrar Máx./Mín. nos cards (dados sempre atuais). */
function injectDemoMedicoesUltimas24h(data) {
  const pad2 = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const at = (hoursAgo, minutesAgo = 0) => {
    const t = new Date(now.getTime() - hoursAgo * 3600000 - minutesAgo * 60000);
    return {
      data: `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`,
      hora: `${pad2(t.getHours())}:${pad2(t.getMinutes())}`
    };
  };
  const atDaysAgo = (daysAgo, hour, minute = 0) => {
    const t = new Date(now);
    t.setDate(t.getDate() - daysAgo);
    t.setHours(hour, minute, 0, 0);
    return {
      data: `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`,
      hora: `${pad2(t.getHours())}:${pad2(t.getMinutes())}`
    };
  };

  const demoRows = {
    'Batimento Cardíaco': [
      { ...at(0, 40), valor: 85, status: 'normal' },
      (() => {
        const slot = at(0, 55);
        const ini = `${slot.data}T${String(slot.hora).slice(0, 5)}:00`;
        const fimDate = new Date(new Date(ini).getTime() + 40 * 60000);
        const fim = `${slot.data}T${String(fimDate.getHours()).padStart(2, '0')}:${String(fimDate.getMinutes()).padStart(2, '0')}:00`;
        return {
          ...slot,
          valor: 108,
          status: 'normal',
          contextoColeta: 'exercicio',
          exercicioSessao: {
            nomeAtividade: 'Demo · Esteira',
            inicioISO: ini,
            fimISO: fim,
            duracaoSegundos: 40 * 60,
            caloriasKcal: 210,
            freqMedia: 104,
            freqMax: 112,
            amostras: [
              { offsetSec: 0, bpm: 92 },
              { offsetSec: 600, bpm: 108 },
              { offsetSec: 1200, bpm: 102 },
              { offsetSec: 1800, bpm: 98 }
            ]
          }
        };
      })(),
      { ...at(3, 10), valor: 72, status: 'normal' },
      { ...at(9, 0), valor: 94, status: 'normal' },
      { ...at(19, 30), valor: 64, status: 'normal' },
      (() => {
        const slot = atDaysAgo(0, 4, 20);
        const ini = `${slot.data}T04:20:00`;
        const fim = `${slot.data}T11:45:00`;
        return {
          ...slot,
          valor: 54,
          status: 'normal',
          contextoColeta: 'sono',
          sonoSessao: {
            inicioISO: ini,
            fimISO: fim,
            duracaoMinutos: 445,
            score: 82,
            leveMin: 210,
            remMin: 88,
            profundoMin: 92,
            acordadoMin: 15
          }
        };
      })(),
      { ...atDaysAgo(1, 10, 15), valor: 70, status: 'normal' },
      { ...atDaysAgo(1, 18, 0), valor: 88, status: 'normal' },
      { ...atDaysAgo(2, 8, 0), valor: 62, status: 'normal' },
      { ...atDaysAgo(2, 20, 0), valor: 78, status: 'normal' },
      /* Dois valores distintos por dia civil: min–máx. da barra = agregado do dia, não uma medição só */
      { ...atDaysAgo(3, 12, 30), valor: 82, status: 'normal' },
      { ...atDaysAgo(3, 20, 15), valor: 96, status: 'normal' },
      { ...atDaysAgo(4, 7, 0), valor: 58, status: 'normal' },
      { ...atDaysAgo(4, 18, 30), valor: 74, status: 'normal' },
      { ...atDaysAgo(5, 14, 0), valor: 68, status: 'normal' },
      { ...atDaysAgo(5, 21, 45), valor: 81, status: 'normal' },
      { ...atDaysAgo(6, 8, 5), valor: 68, status: 'normal' },
      { ...atDaysAgo(6, 19, 0), valor: 84, status: 'normal' },
      { ...atDaysAgo(7, 7, 40), valor: 62, status: 'normal' },
      { ...atDaysAgo(7, 17, 20), valor: 78, status: 'normal' },
      { ...atDaysAgo(8, 9, 10), valor: 71, status: 'normal' },
      { ...atDaysAgo(8, 20, 0), valor: 88, status: 'normal' },
      { ...atDaysAgo(9, 8, 20), valor: 65, status: 'normal' },
      { ...atDaysAgo(9, 18, 40), valor: 79, status: 'normal' },
      { ...atDaysAgo(10, 12, 0), valor: 73, status: 'normal' },
      { ...atDaysAgo(10, 21, 15), valor: 86, status: 'normal' },
      { ...atDaysAgo(11, 11, 15), valor: 69, status: 'normal' },
      { ...atDaysAgo(11, 19, 30), valor: 82, status: 'normal' },
      { ...atDaysAgo(12, 10, 45), valor: 66, status: 'normal' },
      { ...atDaysAgo(12, 18, 0), valor: 77, status: 'normal' },
      { ...atDaysAgo(13, 9, 30), valor: 72, status: 'normal' },
      { ...atDaysAgo(13, 20, 10), valor: 89, status: 'normal' },
      { ...atDaysAgo(14, 8, 0), valor: 64, status: 'normal' },
      { ...atDaysAgo(14, 17, 45), valor: 80, status: 'normal' },
      ...gerarBatimentoDemoPorHora(now)
    ],
    'Pressão Arterial': (() => {
      const _morS = [122,118,132,125,130,119,138,124,116,131,127,121,135,120,128,141,117,126,133,119,124,136,118,129,122,130,115,127,134,121,125];
      const _morD = [81, 76, 86, 82, 85, 79, 90, 81, 74, 87, 84, 80, 88, 78, 84, 92, 76, 83, 87, 78, 81, 89, 76, 84, 80, 85, 73, 82, 88, 79, 83];
      // Mock annotations per day index
      const _mockMed = ['tomados','tomados','nenhum','tomados','tomados','nenhum','tomados','tomados','nenhum','tomados','tomados','nenhum','tomados','tomados','nenhum','tomados','tomados','nenhum','tomados','tomados','nenhum','tomados','tomados','nenhum','tomados','tomados','nenhum','tomados','tomados','nenhum','tomados'];
      const _mockAno = ['Acordei bem disposto','Após caminhada 30 min',undefined,undefined,'Dor de cabeça leve',undefined,undefined,'Medido após almoço',undefined,undefined,undefined,undefined,'Pressão subiu com estresse',undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined];
      const _mockSin = [undefined,undefined,'cefaleia',undefined,undefined,undefined,'tontura',undefined,undefined,undefined,undefined,'cefaleia',undefined,undefined,undefined,undefined,undefined,undefined,undefined,'cansaço',undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined];
      const _rows = [];
      for (let _i = 0; _i < _morS.length; _i++) {
        const _s = _morS[_i], _d = _morD[_i];
        const _st = _s >= 140 ? 'alta' : _s >= 130 ? 'ligeiramente_alta' : 'normal';
        const _st2 = (_s-5) >= 130 ? 'ligeiramente_alta' : 'normal';
        _rows.push({ ...atDaysAgo(_i, 7, 30), valor: { sistolica: _s, diastolica: _d }, status: _st, medicamentoPressao: _mockMed[_i], anotacao: _mockAno[_i], sintomas: _mockSin[_i] });
        _rows.push({ ...atDaysAgo(_i, 18, 15), valor: { sistolica: _s - 5, diastolica: _d - 3 }, status: _st2 });
        if (_i % 3 === 0) _rows.push({ ...atDaysAgo(_i, 13, 0), valor: { sistolica: _s + 3, diastolica: _d + 2 }, status: (_s+3) >= 140 ? 'alta' : _st });
        if (_i % 6 === 0) _rows.push({ ...atDaysAgo(_i, 15, 30), valor: { sistolica: _s - 2, diastolica: _d - 1 }, status: _st, sintomas: _i === 0 ? 'tontura' : undefined });
      }
      return _rows;
    })(),
    Temperatura: [
      { ...at(1, 0), valor: 36.9, status: 'normal' },
      { ...at(7, 0), valor: 36.4, status: 'normal' },
      { ...at(14, 0), valor: 37.2, status: 'normal' },
      { ...at(20, 0), valor: 36.6, status: 'normal' }
    ],
    Passos: [
      { ...at(1, 0), valor: 8840, status: 'normal' },
      { ...at(8, 0), valor: 4120, status: 'normal' },
      { ...at(16, 0), valor: 7260, status: 'normal' },
      { ...at(22, 0), valor: 3180, status: 'normal' }
    ],
    Oxigenação: [
      { ...at(0, 20), valor: 98, status: 'normal' },
      { ...at(5, 0), valor: 96, status: 'normal' },
      { ...at(12, 0), valor: 99, status: 'normal' },
      { ...at(18, 0), valor: 97, status: 'normal' }
    ],
    Calorias: [
      { ...at(2, 0), valor: 2180, status: 'normal' },
      { ...at(9, 0), valor: 1640, status: 'normal' },
      { ...at(15, 0), valor: 2050, status: 'normal' },
      { ...at(23, 0), valor: 1420, status: 'normal' }
    ],
    Glicemia: [
      { ...at(0, 30), valor: 92, status: 'normal' },
      { ...at(6, 0), valor: 104, status: 'atencao' },
      { ...at(13, 0), valor: 88, status: 'normal' },
      { ...at(20, 0), valor: 97, status: 'normal' }
    ],
    HRV: [
      { ...at(1, 0), valor: 54, status: 'normal' },
      { ...at(8, 0), valor: 42, status: 'normal' },
      { ...at(14, 0), valor: 58, status: 'normal' },
      { ...at(21, 0), valor: 47, status: 'normal' }
    ],
    'Nível de Estresse': [
      { ...at(0, 50), valor: 34, status: 'normal' },
      { ...at(5, 0), valor: 46, status: 'atencao' },
      { ...at(12, 0), valor: 28, status: 'normal' },
      { ...at(19, 0), valor: 41, status: 'normal' }
    ],
    Sono: [
      { ...at(4, 0), valor: 7.4, status: 'normal' },
      { ...at(14, 0), valor: 6.2, status: 'atencao' },
      { ...at(22, 0), valor: 8.1, status: 'normal' }
    ],
    Hidratação: [
      { ...at(0, 15), valor: 1950, status: 'normal' },
      { ...at(6, 0), valor: 1200, status: 'atencao' },
      { ...at(13, 0), valor: 2400, status: 'normal' },
      { ...at(20, 0), valor: 1550, status: 'normal' }
    ],
    'Freq. Respiratória': [
      { ...at(0, 25), valor: 16, status: 'normal' },
      { ...at(5, 0), valor: 19, status: 'normal' },
      { ...at(11, 0), valor: 14, status: 'normal' },
      { ...at(17, 0), valor: 17, status: 'normal' }
    ]
  };

  data.sinaisVitais.forEach((vital) => {
    const rows = demoRows[vital.tipo];
    if (!rows || !Array.isArray(vital.historico)) return;

    const sortedDesc = [...rows].sort((a, b) => historicoEntryToMs(b) - historicoEntryToMs(a));
    for (let i = sortedDesc.length - 1; i >= 0; i -= 1) {
      const h = { ...sortedDesc[i] };
      if (h.data) {
        const isoDate = toISODate(h.data);
        if (isoDate) h.data = isoDate;
      }
      h.dataISO = h.data;
      h.dataHoraISO = toISODateTime(h.data, h.hora || '00:00');
      h.demoUltimas24h = true;
      vital.historico.unshift(h);
    }

    const newest = vital.historico[0];
    if (!newest) return;
    if (vital.tipo === 'Pressão Arterial' && newest.valor && typeof newest.valor === 'object') {
      vital.valor = { sistolica: newest.valor.sistolica, diastolica: newest.valor.diastolica };
    } else {
      vital.valor = newest.valor;
    }
    const hm = newest.hora ? newest.hora.slice(0, 5) : '00:00';
    vital.dataHora = `${newest.data}T${hm}:00`;
    vital.dataHoraISO = vital.dataHora;
    vital.tempo = 'Agora';
  });
}

function formatISODateBR(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const [yyyy, mm, dd] = isoDate.split('-');
  if (!yyyy || !mm || !dd) return isoDate;
  return `${dd}/${mm}/${yyyy}`;
}

function formatISODateTimeBR(isoDateTime) {
  if (!isoDateTime || typeof isoDateTime !== 'string') return '';
  const parts = isoDateTime.split('T');
  if (parts.length !== 2) return formatISODateBR(isoDateTime);
  const date = formatISODateBR(parts[0]);
  const time = parts[1].slice(0, 5);
  return `${date} ${time}`;
}

function enrichItemDateFields(item) {
  if (!item || typeof item !== 'object') return;
  if (item.data) {
    const iso = toISODate(item.data);
    if (iso) item.data = iso;
    item.dataISO = item.data;
  }
  if (item.dataHora) {
    const parts = item.dataHora.split(' ');
    if (parts.length === 2) {
      const isoDateTime = toISODateTime(parts[0], parts[1]);
      if (isoDateTime) item.dataHora = isoDateTime;
    } else {
      const isoDate = toISODate(item.dataHora);
      if (isoDate) item.dataHora = `${isoDate}T00:00:00`;
    }
    item.dataHoraISO = item.dataHora;
  }
}

/** Histórico de doses com datas ISO relativas ao dia corrente; executar antes de normalizeMockDataForAnalysis. */
function injectMedicacaoHistoricoDemo(data) {
  if (!data || !Array.isArray(data.medicacoes)) return;

  const dayISO = (deltaDays) => {
    const d = new Date();
    d.setDate(d.getDate() + deltaDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const H0 = dayISO(0);
  const H1 = dayISO(-1);
  const H2 = dayISO(-2);
  const H3 = dayISO(-3);
  const H4 = dayISO(-4);

  const apply = (id, rows) => {
    const med = data.medicacoes.find((m) => m.id === id);
    if (med) med.historico = rows.map((r) => ({ ...r }));
  };

  apply(1, [
    { data: H0, hora: '08:00', status: 'tomado' },
    { data: H0, hora: '14:30', status: 'tomado' },
    { data: H0, hora: '20:00', status: 'pendente' },
    { data: H1, hora: '08:00', status: 'tomado' },
    { data: H1, hora: '14:30', status: 'tomado' },
    { data: H1, hora: '20:00', status: 'tomado' },
    { data: H2, hora: '08:00', status: 'tomado' },
    { data: H2, hora: '14:30', status: 'tomado' },
    { data: H2, hora: '20:00', status: 'tomado' }
  ]);

  apply(2, [
    { data: H0, hora: '08:00', status: 'tomado' },
    { data: H1, hora: '08:00', status: 'tomado' },
    { data: H2, hora: '08:00', status: 'tomado' },
    { data: H3, hora: '08:00', status: 'tomado' },
    { data: H4, hora: '08:00', status: 'tomado' }
  ]);

  apply(3, [
    { data: H0, hora: '08:00', status: 'tomado' },
    { data: H0, hora: '20:00', status: 'pendente' },
    { data: H1, hora: '08:00', status: 'tomado' },
    { data: H1, hora: '20:00', status: 'tomado' },
    { data: H2, hora: '08:00', status: 'tomado' },
    { data: H2, hora: '20:00', status: 'tomado' }
  ]);

  apply(4, [
    { data: H0, hora: '20:00', status: 'pendente' },
    { data: H1, hora: '20:00', status: 'tomado' },
    { data: H2, hora: '20:00', status: 'tomado' },
    { data: H3, hora: '20:00', status: 'tomado' },
    { data: H4, hora: '20:00', status: 'tomado' }
  ]);

  apply(5, [
    { data: H0, hora: '07:00', status: 'tomado' },
    { data: H1, hora: '07:00', status: 'tomado' },
    { data: H2, hora: '07:00', status: 'tomado' },
    { data: H3, hora: '07:00', status: 'tomado' },
    { data: H4, hora: '07:00', status: 'nao_tomado' }
  ]);
}

function normalizeMockDataForAnalysis(data) {
  // Sinais vitais
  data.sinaisVitais.forEach(vital => {
    enrichItemDateFields(vital);
    vital.ideal = parseIdealObject(vital.ideal);

    if (vital.tipo === 'Pressão Arterial') {
      const parsed = parsePressureValue(vital.valor);
      if (parsed) vital.valor = parsed;
    }

    if (Array.isArray(vital.historico)) {
      vital.historico.forEach(h => {
        if (h.data) {
          const isoDate = toISODate(h.data);
          if (isoDate) h.data = isoDate;
        }
        h.dataISO = h.data;
        h.dataHoraISO = toISODateTime(h.data, h.hora || '00:00');

        if (vital.tipo === 'Pressão Arterial') {
          const parsedValor = parsePressureValue(h.valor);
          const parsedAnterior = parsePressureValue(h.anterior);
          if (parsedValor) h.valor = parsedValor;
          if (parsedAnterior) h.anterior = parsedAnterior;
        }
      });
    }
  });

  // Composição corporal
  data.composicaoCorporal.forEach(item => {
    enrichItemDateFields(item);
    item.ideal = parseIdealObject(item.ideal);
    if (Array.isArray(item.historico)) {
      item.historico.forEach(h => {
        if (h.data) {
          const isoDate = toISODate(h.data);
          if (isoDate) h.data = isoDate;
        }
        h.dataISO = h.data;
      });
    }
  });

  // Medicações e histórico
  data.medicacoes.forEach(med => {
    med.dataInicio = toISODate(med.dataInicio) || med.dataInicio;
    med.dataFim = toISODate(med.dataFim) || med.dataFim;
    med.dataInicioISO = med.dataInicio;
    med.dataFimISO = med.dataFim;
    if (med.dataInicio && med.dataFim && (med.duracaoDias == null || med.duracaoDias === undefined)) {
      const inferred = inferDuracaoDiasFromInicioFim(med.dataInicio, med.dataFim);
      if (inferred) med.duracaoDias = inferred;
    }
    if (Array.isArray(med.historico)) {
      med.historico.forEach(h => {
        if (h.data) {
          const isoDate = toISODate(h.data);
          if (isoDate) h.data = isoDate;
        }
        h.dataISO = h.data;
        h.dataHoraISO = toISODateTime(h.data, h.hora || '00:00');
      });
    }
  });

  // Agenda / exames
  data.consultas.forEach(item => {
    item.data = toISODate(item.data) || item.data;
    item.dataISO = item.data;
    item.dataHoraISO = toISODateTime(item.data, item.hora || '00:00');
  });

  data.examesAgendados.forEach(item => {
    item.data = toISODate(item.data) || item.data;
    item.dataISO = item.data;
  });

  data.examesRealizados.forEach(item => {
    item.data = toISODate(item.data) || item.data;
    item.dataISO = item.data;
  });

  data.ecgs.forEach(item => {
    enrichItemDateFields(item);
    if (Array.isArray(item.historico)) {
      item.historico.forEach(h => {
        if (h.data) {
          const isoDate = toISODate(h.data);
          if (isoDate) h.data = isoDate;
        }
        h.dataISO = h.data;
        h.dataHoraISO = toISODateTime(h.data, h.hora || '00:00');
      });
    }
  });
}

injectMedicacaoHistoricoDemo(mockData);
normalizeMockDataForAnalysis(mockData);
injectDemoMedicoesUltimas24h(mockData);