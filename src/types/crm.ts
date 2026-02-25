export interface Acuerdo {
  id: string;
  influencer: string;
  redSocial: string[];
  seguidores: number;
  plataforma: string;
  tipoContenido: string[];
  reelsPactados: number;
  storiesPactadas: number;
  fechaInicio: string;
  fechaFin: string;
  duracionMeses: number;
  valorMensual: number;
  valorTotal: number;
  moneda: string;
  estado: "En Negociación" | "Activo" | "Pausado" | "Finalizado" | "Cancelado";
  contacto: string;
  familiaProducto: string[];
  notas: string;
  createdAt: string;
}

export interface Pago {
  id: string;
  acuerdoId: string;
  influencer: string;
  concepto: string;
  monto: number;
  moneda: string;
  fechaPago: string;
  estado: "Pendiente" | "Pagado" | "Vencido" | "Cancelado" | "Programado";
  metodoPago: string;
  comprobante: string;
  notas: string;
  createdAt: string;
}

export interface Entregable {
  id: string;
  acuerdoId: string;
  influencer: string;
  tipoContenido: "Reel" | "Story" | "Collab" | "UGC";
  descripcion: string;
  fechaProgramada: string;
  fechaEntrega: string;
  estado: "Pendiente" | "En progreso" | "Entregado" | "Aprobado" | "Rechazado";
  urlContenido: string;
  notas: string;
  createdAt: string;
}

export interface KPI {
  id: string;
  entregableId: string;
  acuerdoId: string;
  influencer: string;
  alcance: number;
  impresiones: number;
  interacciones: number;
  clicks: number;
  engagement: number;
  cpr: number;
  cpc: number;
  periodo: string;
  estado: "Pendiente" | "Medido" | "Revisado" | "Aprobado";
  notas: string;
  createdAt: string;
}
