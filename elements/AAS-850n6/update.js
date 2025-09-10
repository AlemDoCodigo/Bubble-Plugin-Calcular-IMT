function(instance, properties, context) {
  // Entradas (textos aceites) + números
  const local = properties.local_imovel;                 // "continente" | "regiões autónomas"
  const fim   = properties.finalidade;                   // "habitação própria e permanente" | "habitação"
  const valor = (typeof properties.valor_imovel === 'number' && isFinite(properties.valor_imovel)) ? properties.valor_imovel : 0;
  const imtJovem = properties.imt_jovem === true;        // yes/no

  // percent para Imposto do Selo (ex.: 0.008 para 0,8%)
  const percentSelo = (typeof properties.percent_imposto_selo === 'number' && isFinite(properties.percent_imposto_selo))
    ? properties.percent_imposto_selo
    : 0;

  // Tabelas com intervalos explícitos: (valor > min) && (valor <= max)
  const T = {
    "continente": {
      "habitação própria e permanente": [ // Tabela I
        { min: -Infinity, max: 104261,  rate: 0.00,  deduct: 0 },
        { min: 104261,    max: 142618,  rate: 0.02,  deduct: 2085.22 },
        { min: 142618,    max: 194458,  rate: 0.05,  deduct: 6363.76 },
        { min: 194458,    max: 324058,  rate: 0.07,  deduct: 10252.92 },
        { min: 324058,    max: 648022,  rate: 0.08,  deduct: 13493.50 },
        { min: 648022,    max: 1128287, rate: 0.06,  deduct: 0 },        // taxa única 6%
        { min: 1128287,   max: Infinity,rate: 0.075, deduct: 0 },        // superior
      ],
      "_hpp_jovem": [ // Tabela II – HPP Jovem ≤35
        { min: -Infinity, max: 324058,  rate: 0.00,  deduct: 0 },
        { min: 324058,    max: 648022,  rate: 0.08,  deduct: 25924.64 },
        { min: 648022,    max: 1128287, rate: 0.06,  deduct: 0 },
        { min: 1128287,   max: Infinity,rate: 0.075, deduct: 0 },
      ],
      "habitação": [ // Tabela III – não HPP
        { min: -Infinity, max: 104261,  rate: 0.01,  deduct: 0 },
        { min: 104261,    max: 142618,  rate: 0.02,  deduct: 1042.61 },
        { min: 142618,    max: 194458,  rate: 0.05,  deduct: 5321.15 },
        { min: 194458,    max: 324058,  rate: 0.07,  deduct: 9210.31 },
        { min: 324058,    max: 621501,  rate: 0.08,  deduct: 12450.89 },
        { min: 621501,    max: 1128287, rate: 0.06,  deduct: 0 },
        { min: 1128287,   max: Infinity,rate: 0.075, deduct: 0 },
      ],
    },
    "regiões autónomas": {
      "habitação própria e permanente": [ // Tabela IV
        { min: -Infinity, max: 130326,  rate: 0.00,  deduct: 0 },
        { min: 130326,    max: 178273,  rate: 0.02,  deduct: 2606.52 },
        { min: 178273,    max: 243073,  rate: 0.05,  deduct: 7954.71 },
        { min: 243073,    max: 405073,  rate: 0.07,  deduct: 12816.17 },
        { min: 405073,    max: 810028,  rate: 0.08,  deduct: 16866.90 },
        { min: 810028,    max: 1410359, rate: 0.06,  deduct: 0 },
        { min: 1410359,   max: Infinity,rate: 0.075, deduct: 0 },
      ],
      "_hpp_jovem": [ // Tabela V – HPP Jovem ≤35
        { min: -Infinity, max: 405073,  rate: 0.00,  deduct: 0 },
        { min: 405073,    max: 810028,  rate: 0.08,  deduct: 32405.80 },
        { min: 810028,    max: 1410359, rate: 0.06,  deduct: 0 },
        { min: 1410359,   max: Infinity,rate: 0.075, deduct: 0 },
      ],
      "habitação": [ // Tabela VI – não HPP
        { min: -Infinity, max: 130326,  rate: 0.01,  deduct: 0 },
        { min: 130326,    max: 178273,  rate: 0.02,  deduct: 1303.26 },
        { min: 178273,    max: 243073,  rate: 0.05,  deduct: 6651.45 },
        { min: 243073,    max: 405073,  rate: 0.07,  deduct: 11512.91 },
        { min: 405073,    max: 776876,  rate: 0.08,  deduct: 15563.64 },
        { min: 776876,    max: 1410359, rate: 0.06,  deduct: 0 },
        { min: 1410359,   max: Infinity,rate: 0.075, deduct: 0 },
      ],
    },
  };

  // validação dos textos aceites
  const validLocal = local === "continente" || local === "regiões autónomas";
  const validFim   = fim === "habitação própria e permanente" || fim === "habitação";

  let imt = 0, taxa = 0, abater = 0;

  if (validLocal && validFim) {
    // só usa tabela de jovem quando é HPP e imt_jovem = yes
    const usarJovem = (fim === "habitação própria e permanente") && imtJovem;
    const key = usarJovem ? "_hpp_jovem" : fim;
    const escalas = T[local][key];

    // encontra o intervalo correto: > min e ≤ max
    const esc = escalas.find(e => valor > e.min && valor <= e.max) || escalas[escalas.length - 1];

    taxa = esc.rate;
    abater = esc.deduct || 0;
    imt = valor * taxa - abater;
    if (imt < 0) imt = 0;
  }

  // ===== Imposto do Selo (regras 2025 quando imt_jovem = true) =====
  // Limites de isenção total e parcial (euros) — agora dependentes do "local"
  let LIMITE_ISENCAO_TOTAL, LIMITE_ISENCAO_PARCIAL;
  if (local === "regiões autónomas") {
    // Regiões Autónomas
    LIMITE_ISENCAO_TOTAL = 405073;
    LIMITE_ISENCAO_PARCIAL = 810028;
  } else {
    // Continente (comportamento anterior)
    LIMITE_ISENCAO_TOTAL = 324058;
    LIMITE_ISENCAO_PARCIAL = 648022;
  }

  let impostoSelo = 0;

  if (imtJovem === true) {
    // Isenção Total
    if (valor <= LIMITE_ISENCAO_TOTAL) {
      impostoSelo = 0;
    }
    // Isenção Parcial: taxa aplica-se só ao excedente
    else if (valor > LIMITE_ISENCAO_TOTAL && valor <= LIMITE_ISENCAO_PARCIAL) {
      impostoSelo = (valor - LIMITE_ISENCAO_TOTAL) * percentSelo; // ex.: 0.8% => 0.008
    }
    // Sem isenção (valor acima do limite parcial)
    else {
      impostoSelo = valor * percentSelo;
    }
  } else {
    // Regra geral (sem isenção jovem)
    impostoSelo = valor * percentSelo;
  }

  // Publicação dos states
  instance.publishState("valor_imt", imt);
  instance.publishState("taxa", taxa);
  instance.publishState("parcela_a_abater", abater);
  instance.publishState("imposto_selo", impostoSelo);
}