import { Acuerdo, Pago, Entregable, KPI } from "@/types/crm";

const STORAGE_KEYS = {
  acuerdos: "crm_acuerdos",
  pagos: "crm_pagos",
  entregables: "crm_entregables",
  kpis: "crm_kpis",
};

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function generateId(): string {
  return crypto.randomUUID();
}

// Acuerdos
export function getAcuerdos(): Acuerdo[] {
  return load<Acuerdo>(STORAGE_KEYS.acuerdos);
}
export function saveAcuerdo(a: Acuerdo) {
  const all = getAcuerdos();
  const idx = all.findIndex((x) => x.id === a.id);
  if (idx >= 0) all[idx] = a;
  else all.push(a);
  save(STORAGE_KEYS.acuerdos, all);
}
export function deleteAcuerdo(id: string) {
  save(STORAGE_KEYS.acuerdos, getAcuerdos().filter((x) => x.id !== id));
}

// Pagos
export function getPagos(): Pago[] {
  return load<Pago>(STORAGE_KEYS.pagos);
}
export function savePago(p: Pago) {
  const all = getPagos();
  const idx = all.findIndex((x) => x.id === p.id);
  if (idx >= 0) all[idx] = p;
  else all.push(p);
  save(STORAGE_KEYS.pagos, all);
}
export function deletePago(id: string) {
  save(STORAGE_KEYS.pagos, getPagos().filter((x) => x.id !== id));
}

// Entregables
export function getEntregables(): Entregable[] {
  return load<Entregable>(STORAGE_KEYS.entregables);
}
export function saveEntregable(e: Entregable) {
  const all = getEntregables();
  const idx = all.findIndex((x) => x.id === e.id);
  if (idx >= 0) all[idx] = e;
  else all.push(e);
  save(STORAGE_KEYS.entregables, all);
}
export function deleteEntregable(id: string) {
  save(STORAGE_KEYS.entregables, getEntregables().filter((x) => x.id !== id));
}

// KPIs
export function getKPIs(): KPI[] {
  return load<KPI>(STORAGE_KEYS.kpis);
}
export function saveKPI(k: KPI) {
  const all = getKPIs();
  const idx = all.findIndex((x) => x.id === k.id);
  if (idx >= 0) all[idx] = k;
  else all.push(k);
  save(STORAGE_KEYS.kpis, all);
}
export function deleteKPI(id: string) {
  save(STORAGE_KEYS.kpis, getKPIs().filter((x) => x.id !== id));
}
