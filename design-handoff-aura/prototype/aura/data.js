// ============================================================
// AURA — Datos mock para el prototipo. window.DATA
// ============================================================
window.DATA = {
  cliente: {
    nombre: 'María Elena García',
    correo: 'mariaelena.g@gmail.com',
    telefono: '+52 55 1234 5678',
    nacimiento: '1981-04-12',
    programa: 'CuarentaMás',
    variante: 'Principiante',
    dia: 12,
    totalDias: 180,
    mes: 1,
    totalMeses: 6,
    inicio: '15 ene 2026',
    estado: 'activa',
    proximoCobro: '15 jul 2026',
    monto: 'MX$799',
    tarjeta: '•••• 4242',
  },

  hoy: {
    fecha: 'Miércoles, 3 de junio',
    dia: 12,
    titulo: 'Piernas y Glúteos',
    tipo: 'entrenamiento',
    duracion: 40,
    intro: 'Hoy trabajamos tren inferior con enfoque en fuerza. Recuerda: a cada serie le ganas resistencia. Ve con calma, escucha a tu cuerpo y celebra cada repetición.',
    bloques: [
      { id: 'b1', tipo: 'richtext' },
      { id: 'b2', tipo: 'youtube', titulo: 'Calentamiento — Lubricación articular', dur: '8 minutos' },
      { id: 'b3', tipo: 'exercises' },
      { id: 'b4', tipo: 'pdf', archivo: 'Plan de alimentación — Día 12', tam: '1.2 MB' },
      { id: 'b5', tipo: 'youtube', titulo: 'Estiramiento full body', dur: '6 minutos' },
    ],
  },

  ejercicios: [
    { id: 'e1', nombre: 'Sentadilla con mancuerna', series: 3, reps: 12, descanso: 60, nota: 'Rodillas alineadas con la punta de los pies. Baja con control.', metricas: ['reps', 'peso'] },
    { id: 'e2', nombre: 'Peso muerto rumano', series: 3, reps: 10, descanso: 75, nota: 'Espalda recta, lleva la cadera hacia atrás.', metricas: ['reps', 'peso'] },
    { id: 'e3', nombre: 'Puente de glúteo', series: 3, reps: 15, descanso: 45, nota: 'Aprieta el glúteo arriba 2 segundos.', metricas: ['reps'] },
    { id: 'e4', nombre: 'Zancada estática', series: 3, reps: 12, descanso: 60, nota: 'Una pierna a la vez. 12 por lado.', metricas: ['reps', 'peso'] },
    { id: 'e5', nombre: 'Elevación de talones', series: 3, reps: 20, descanso: 30, nota: 'Sube lento, baja lento.', metricas: ['reps'] },
  ],

  metricas: [
    { fecha: '15 ene', peso: 72.0, cintura: 88, cadera: 102 },
    { fecha: '1 feb', peso: 71.2, cintura: 86, cadera: 101 },
    { fecha: '15 feb', peso: 70.5, cintura: 85, cadera: 100 },
    { fecha: '1 mar', peso: 69.8, cintura: 84, cadera: 99 },
    { fecha: '15 mar', peso: 69.1, cintura: 83, cadera: 98 },
    { fecha: '1 abr', peso: 68.9, cintura: 82, cadera: 97 },
    { fecha: '15 may', peso: 68.5, cintura: 81, cadera: 96 },
  ],

  fotos: [
    { id: 'f1', fecha: '15 ene', angulo: 'Frente' }, { id: 'f2', fecha: '15 ene', angulo: 'Lado' }, { id: 'f3', fecha: '15 ene', angulo: 'Espalda' },
    { id: 'f4', fecha: '1 mar', angulo: 'Frente' }, { id: 'f5', fecha: '1 mar', angulo: 'Lado' }, { id: 'f6', fecha: '1 mar', angulo: 'Espalda' },
    { id: 'f7', fecha: '15 may', angulo: 'Frente' }, { id: 'f8', fecha: '15 may', angulo: 'Lado' }, { id: 'f9', fecha: '15 may', angulo: 'Espalda' },
  ],

  progreso: {
    resumen: { entrenamientos: '11 / 12', racha: 8, repsTotales: '1,240' },
    ejerciciosFuerza: ['Sentadilla con mancuerna', 'Peso muerto rumano', 'Zancada estática'],
    fuerza: {
      'Sentadilla con mancuerna': [{ fecha: '5 may', v: 6 }, { fecha: '12 may', v: 7 }, { fecha: '19 may', v: 8 }, { fecha: '26 may', v: 8 }, { fecha: '2 jun', v: 10 }],
      'Peso muerto rumano': [{ fecha: '5 may', v: 8 }, { fecha: '12 may', v: 9 }, { fecha: '19 may', v: 10 }, { fecha: '26 may', v: 12 }, { fecha: '2 jun', v: 12 }],
      'Zancada estática': [{ fecha: '5 may', v: 4 }, { fecha: '12 may', v: 5 }, { fecha: '19 may', v: 6 }, { fecha: '26 may', v: 6 }, { fecha: '2 jun', v: 7 }],
    },
    historial: [
      { fecha: '3 jun', dia: 'Piernas y Glúteos', done: '5/5' },
      { fecha: '1 jun', dia: 'Tren superior — Empuje', done: '4/5' },
      { fecha: '30 may', dia: 'Core y estabilidad', done: '5/5' },
      { fecha: '28 may', dia: 'Cardio Zona 2', done: '—', tipo: 'cardio' },
      { fecha: '27 may', dia: 'Piernas y Glúteos', done: '5/5' },
    ],
  },

  mensajes: [
    { id: 'm1', asunto: '¡Vamos por el mes 2! 💜', preview: 'Estoy muy orgullosa de tu constancia. Este mes subimos un poco la intensidad...', fecha: 'Hace 2 días', leido: false, fechaCompleta: '1 de junio, 2026 · 9:14',
      cuerpo: 'Hola María,\n\nQuería tomarme un momento para decirte lo orgullosa que estoy de tu constancia este primer mes. No siempre es fácil empezar, y tú lo estás haciendo increíble.\n\nEste mes vamos a subir un poquito la intensidad en las piernas. No te asustes si sientes el cuerpo distinto: es señal de que estás ganando fuerza.\n\nCualquier cosa, aquí estoy.\n\nUn abrazo,\nAura' },
    { id: 'm2', asunto: 'Tu plan de alimentación de junio', preview: 'Adjunté el nuevo plan en la sección de hoy. Recuerda hidratarte...', fecha: 'Hace 5 días', leido: false, fechaCompleta: '29 de mayo, 2026 · 18:30',
      cuerpo: 'Hola María,\n\nYa está disponible tu nuevo plan de alimentación para junio en la pantalla de Hoy. Lo ajusté con base en tus últimas medidas.\n\nRecuerda hidratarte bien durante los entrenamientos.\n\nAura' },
    { id: 'm3', asunto: 'Bienvenida a CuarentaMás', preview: 'Qué emoción tenerte aquí. Te dejo algunas recomendaciones para empezar...', fecha: 'Hace 3 semanas', leido: true, fechaCompleta: '15 de enero, 2026 · 11:00',
      cuerpo: 'Hola María,\n\n¡Qué emoción tenerte aquí! Empezar es el paso más valiente, y tú ya lo diste.\n\nMi recomendación para esta primera semana: ve a tu ritmo, no te compares con nadie y disfruta el proceso.\n\nNos vemos en tu primer día.\n\nAura' },
  ],

  onboardingPreguntas: [
    { id: 'q1', texto: '¿Cuál es tu principal objetivo al unirte a este programa?', tipo: 'unica', obligatoria: true,
      opciones: ['Perder peso', 'Ganar fuerza y tono muscular', 'Tener más energía', 'Mejorar mi salud general'] },
    { id: 'q2', texto: '¿Con qué frecuencia te has movido o ejercitado en el último año?', tipo: 'unica', obligatoria: true,
      opciones: ['Casi nunca', 'De vez en cuando', '1-2 veces por semana', '3 o más veces por semana'] },
    { id: 'q3', texto: '¿Cuántos años tienes?', tipo: 'numero', obligatoria: true, unidad: 'años' },
    { id: 'q4', texto: '¿Qué equipo tienes disponible en casa?', tipo: 'multiple', obligatoria: false,
      opciones: ['Mancuernas', 'Bandas elásticas', 'Tapete / colchoneta', 'Banca o silla resistente', 'No tengo equipo aún'] },
    { id: 'q5', texto: '¿Tienes alguna lesión o condición que deba conocer?', tipo: 'libre', obligatoria: false },
    { id: 'q6', texto: '¿Hay algo más que quieras que sepa sobre ti?', tipo: 'libre', obligatoria: false },
  ],

  onboardingRespuestas: {
    q1: 'Ganar fuerza y tono muscular', q2: '1-2 veces por semana', q3: '45',
    q4: ['Mancuernas', 'Tapete / colchoneta'], q5: 'Tuve una molestia en la rodilla derecha hace dos años, ya recuperada.',
    q6: 'Quiero sentirme con más energía para jugar con mis nietos. Me da un poco de miedo lastimarme.',
  },

  // ---------------- ADMIN ----------------
  admin: {
    nombre: 'Aura Maristany',
    kpis: {
      mrr: 'MX$24,350', mrrDelta: '+12%', mrrUp: true,
      activas: 38, activasNuevas: '+3 nuevas este mes',
      porVencer: 12, porVencerMonto: 'MX$9,600 esperados',
      fallidos: 2,
    },
    ingresos: [
      { mes: 'Ene', valor: 16800 }, { mes: 'Feb', valor: 18200 }, { mes: 'Mar', valor: 21800 },
      { mes: 'Abr', valor: 20400 }, { mes: 'May', valor: 22600 }, { mes: 'Jun', valor: 24350 },
    ],
    porPrograma: [
      { nombre: 'CuarentaMás Principiante', clientes: 18, color: '#9982f4' },
      { nombre: 'Strong & Fit Intermedio', clientes: 12, color: '#eddbd8' },
      { nombre: 'CuarentaMás Extra', clientes: 8, color: '#4caf7d' },
    ],
    ingresoPrograma: [
      { nombre: 'CuarentaMás', valor: 14382, color: '#9982f4' },
      { nombre: 'Strong & Fit', valor: 7188, color: '#e0c8c3' },
      { nombre: 'Extra', valor: 2780, color: '#4caf7d' },
    ],
    pagos: [
      { fecha: '3 jun', cliente: 'Laura Méndez', programa: 'CuarentaMás', monto: 'MX$799', estado: 'pagado' },
      { fecha: '3 jun', cliente: 'Paty Rendón', programa: 'Strong & Fit', monto: 'MX$899', estado: 'pagado' },
      { fecha: '2 jun', cliente: 'Sofía Trejo', programa: 'CuarentaMás Extra', monto: 'MX$349', estado: 'fallido' },
      { fecha: '2 jun', cliente: 'Carmen Ruiz', programa: 'CuarentaMás', monto: 'MX$799', estado: 'pagado' },
      { fecha: '1 jun', cliente: 'Diana Soto', programa: 'Strong & Fit', monto: 'MX$899', estado: 'pendiente' },
      { fecha: '1 jun', cliente: 'María E. García', programa: 'CuarentaMás', monto: 'MX$799', estado: 'pagado' },
    ],
    clientes: [
      { id: 'c1', nombre: 'María Elena García', correo: 'mariaelena.g@gmail.com', programa: 'CuarentaMás', variante: 'Principiante', inscripcion: '15 ene 2026', proximo: '15 jul 2026', monto: 'MX$799', estado: 'activa', dia: 12 },
      { id: 'c2', nombre: 'Laura Méndez', correo: 'laura.mendez@gmail.com', programa: 'CuarentaMás', variante: 'Intermedio', inscripcion: '3 feb 2026', proximo: '3 jul 2026', monto: 'MX$799', estado: 'activa', dia: 28 },
      { id: 'c3', nombre: 'Sofía Trejo', correo: 'sofia.t@hotmail.com', programa: 'CuarentaMás Extra', variante: 'Extra', inscripcion: '20 dic 2025', proximo: '20 jun 2026', monto: 'MX$349', estado: 'past_due', dia: 64 },
      { id: 'c4', nombre: 'Paty Rendón', correo: 'paty.rendon@gmail.com', programa: 'Strong & Fit', variante: 'Intermedio', inscripcion: '10 mar 2026', proximo: '10 jul 2026', monto: 'MX$899', estado: 'activa', dia: 41 },
      { id: 'c5', nombre: 'Carmen Ruiz', correo: 'carmen.ruiz@gmail.com', programa: 'CuarentaMás', variante: 'Principiante', inscripcion: '28 abr 2026', proximo: '28 jun 2026', monto: 'MX$799', estado: 'porvencer', dia: 7 },
      { id: 'c6', nombre: 'Diana Soto', correo: 'diana.soto@gmail.com', programa: 'Strong & Fit', variante: 'Avanzado', inscripcion: '5 nov 2025', proximo: '5 jun 2026', monto: 'MX$899', estado: 'porvencer', dia: 89 },
      { id: 'c7', nombre: 'Roxana Pérez', correo: 'roxana.p@gmail.com', programa: 'CuarentaMás', variante: 'Intermedio', inscripcion: '12 feb 2026', proximo: '12 jul 2026', monto: 'MX$799', estado: 'activa', dia: 25 },
      { id: 'c8', nombre: 'Lupita Hernández', correo: 'lupita.h@outlook.com', programa: 'CuarentaMás Extra', variante: 'Extra', inscripcion: '8 ene 2026', proximo: '8 jun 2026', monto: 'MX$349', estado: 'cancelada', dia: 0 },
    ],
    programas: [
      { id: 'p1', nombre: 'CuarentaMás', sub: '5 variantes · 6 meses · 180 días de contenido', publicados: 60, total: 180, tipo: 'grid', icono: 'dumbbell' },
      { id: 'p2', nombre: 'CuarentaMás Extra', sub: '2 variantes · Mensual · 8 series creadas', alerta: 'Serie 9 sin publicar', tipo: 'timeline', icono: 'sparkle' },
      { id: 'p3', nombre: 'Strong & Fit', sub: '3 variantes · Mensual acumulativo · 5 series', nota: 'Última serie: Serie 5 — publicada', tipo: 'timeline', icono: 'target' },
    ],
    series: [
      { id: 's1', mes: 1, titulo: 'Vuelta a los básicos', variante: 'Intermedio', dias: 30, publicados: 30 },
      { id: 's2', mes: 2, titulo: 'Construyendo fuerza', variante: 'Intermedio', dias: 30, publicados: 28 },
      { id: 's3', mes: 3, titulo: 'Resistencia y tono', variante: 'Intermedio', dias: 30, publicados: 12 },
    ],
    diasSerie: [
      { n: 1, titulo: 'Tren superior — Empuje', estado: 'publicado' },
      { n: 2, titulo: 'Descanso activo', estado: 'publicado' },
      { n: 3, titulo: 'Tren inferior — Fuerza', estado: 'publicado' },
      { n: 4, titulo: 'Cardio Zona 2', estado: 'publicado' },
      { n: 5, titulo: 'Tren superior — Jalón', estado: 'borrador' },
      { n: 6, titulo: 'Core y estabilidad', estado: 'borrador' },
      { n: 7, titulo: 'Evaluación semanal', estado: 'vacio' },
    ],
    mensajesEnviados: [
      { id: 'am1', tipo: 'broadcast', dest: 'Todas las de CuarentaMás', asunto: '¡Vamos por el mes 2! 💜', fecha: '1 jun', leidos: 14, total: 18 },
      { id: 'am2', tipo: 'individual', dest: 'María Elena García', asunto: 'Tu plan de alimentación de junio', fecha: '29 may', leidos: 1, total: 1 },
      { id: 'am3', tipo: 'broadcast', dest: 'Todas mis clientes', asunto: 'Nuevo horario de respuestas', fecha: '20 may', leidos: 31, total: 38 },
    ],
  },
};
