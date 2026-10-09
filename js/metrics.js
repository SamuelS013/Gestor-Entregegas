import { db } from './firebase.js';
import {
  collection,
  getDocs,
  query,
  Timestamp,
  where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const facturas = collection(db, 'facturas');
const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});
const dateFormatter = new Intl.DateTimeFormat('es-VE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});
const detailsByMetric = new Map();
let detailEventsRegistered = false;

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date) {
  const start = startOfDay(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function paymentDateRange(start, end) {
  return query(
    facturas,
    where('fechaPago', '>=', Timestamp.fromDate(start)),
    where('fechaPago', '<', Timestamp.fromDate(end))
  );
}

function invoiceDate(invoice, field) {
  const value = invoice[field];
  if (value && typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }
  return null;
}

function amount(invoice) {
  const value = Number(invoice.montoTotal);
  return Number.isFinite(value) ? value : 0;
}

function invoicesFrom(snapshot) {
  return snapshot.docs.map(item => ({ ...item.data(), id: item.id }));
}

function percentageChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function renderTrend(elementId, current, previous, label) {
  const element = document.getElementById(elementId);
  const change = percentageChange(current, previous);
  const roundedChange = Math.round(Math.abs(change));

  element.textContent = `${change > 0 ? '+' : change < 0 ? '-' : ''}${roundedChange}% ${label}`;
  element.classList.remove('positive', 'negative', 'neutral');
  element.classList.add(change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral');
}

function renderLineChart(elementId, values, color, isDetail = false) {
  const container = document.getElementById(elementId);
  const width = isDetail ? 720 : 180;
  const height = isDetail ? 220 : 60;
  const inset = isDetail ? 16 : 5;
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = inset + (index / Math.max(values.length - 1, 1)) * (width - inset * 2);
    const y = height - inset - (value / max) * (height - inset * 2);
    return `${x},${y}`;
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Tendencia diaria">
      <polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="${isDetail ? 4 : 3}"
        stroke-linecap="round" stroke-linejoin="round"></polyline>
    </svg>`;
}

function dayIndex(date, start) {
  const dayTime = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const startTime = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  return Math.floor((dayTime - startTime) / 86400000);
}

function dailySums(invoices, start, dayCount, dateField) {
  const totals = Array(dayCount).fill(0);
  invoices.forEach(invoice => {
    const date = invoiceDate(invoice, dateField);
    if (!date) return;
    const index = dayIndex(date, start);
    if (index >= 0 && index < totals.length) totals[index] += amount(invoice);
  });
  return totals;
}

function dailyRows(invoices, start, dayCount, dateField) {
  const rows = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return { date, count: 0, total: 0 };
  });

  invoices.forEach(invoice => {
    const date = invoiceDate(invoice, dateField);
    if (!date) return;
    const index = dayIndex(date, start);
    if (index < 0 || index >= rows.length) return;
    rows[index].count += 1;
    rows[index].total += amount(invoice);
  });
  return rows;
}

function setupMetricDetails() {
  if (detailEventsRegistered) return;
  detailEventsRegistered = true;

  const modal = document.getElementById('modal-metric-detail');
  const closeButton = document.getElementById('btn-cerrar-detalle-metrica');
  const close = () => modal.classList.add('hidden');

  document.querySelectorAll('.metric-card[data-metric]').forEach(card => {
    const open = () => openMetricDetail(card.dataset.metric);
    card.addEventListener('click', open);
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });

  closeButton.addEventListener('click', close);
  modal.addEventListener('click', event => {
    if (event.target === modal) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
}

function appendCell(row, text) {
  const cell = document.createElement('td');
  cell.textContent = text;
  row.appendChild(cell);
}

function openMetricDetail(key) {
  const detail = detailsByMetric.get(key);
  if (!detail) return;

  document.getElementById('metric-detail-title').textContent = detail.title;
  document.getElementById('metric-detail-total').textContent = currency.format(detail.total);
  document.getElementById('metric-detail-period').textContent = detail.period;
  renderLineChart('metric-detail-chart', detail.chartValues, detail.color, true);

  const head = document.getElementById('metric-detail-head');
  const rows = document.getElementById('metric-detail-rows');
  head.replaceChildren();
  rows.replaceChildren();
  const headerRow = document.createElement('tr');
  detail.columns.forEach(column => {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = column;
    headerRow.appendChild(cell);
  });
  head.appendChild(headerRow);

  detail.rows.forEach(values => {
    const row = document.createElement('tr');
    values.forEach(value => appendCell(row, value));
    rows.appendChild(row);
  });
  if (detail.rows.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = detail.columns.length;
    cell.textContent = 'No hay registros para este periodo.';
    row.appendChild(cell);
    rows.appendChild(row);
  }

  document.getElementById('modal-metric-detail').classList.remove('hidden');
}

function formatDate(date) {
  return dateFormatter.format(date);
}

function setMetricError(message = '') {
  const element = document.getElementById('metrics-error');
  element.textContent = message;
  element.classList.toggle('hidden', !message);
}

export async function initMetrics() {
  setupMetricDetails();
  setMetricError();
  const today = startOfDay(new Date());
  const thisWeekStart = startOfWeek(today);
  const previousWeekStart = new Date(thisWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const dayOfWeek = Math.floor((today.getTime() - thisWeekStart.getTime()) / 86400000);
  const elapsedWeekDays = dayOfWeek + 1;
  const previousWeekEnd = new Date(previousWeekStart);
  previousWeekEnd.setDate(previousWeekEnd.getDate() + elapsedWeekDays);
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const daysInPreviousMonth = new Date(
    previousMonthStart.getFullYear(),
    previousMonthStart.getMonth() + 1,
    0
  ).getDate();
  const previousMonthCompareEnd = new Date(previousMonthStart);
  previousMonthCompareEnd.setDate(Math.min(today.getDate(), daysInPreviousMonth) + 1);
  const monthDays = today.getDate();
  const debtChartStart = new Date(today);
  debtChartStart.setDate(debtChartStart.getDate() - 6);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    const [thisWeek, previousWeek, thisMonth, previousMonth, debtInvoices] = await Promise.all([
      getDocs(paymentDateRange(thisWeekStart, tomorrow)),
      getDocs(paymentDateRange(previousWeekStart, previousWeekEnd)),
      getDocs(paymentDateRange(thisMonthStart, tomorrow)),
      getDocs(paymentDateRange(previousMonthStart, previousMonthCompareEnd)),
      getDocs(query(facturas, where('montoTotal', '>', 0)))
    ]);

    const weekPayments = invoicesFrom(thisWeek).filter(invoice => invoice.pagada);
    const monthPayments = invoicesFrom(thisMonth).filter(invoice => invoice.pagada);
    const unpaidInvoices = invoicesFrom(debtInvoices).filter(invoice => !invoice.pagada);
    const weekTotal = weekPayments.reduce((total, invoice) => total + amount(invoice), 0);
    const previousWeekTotal = invoicesFrom(previousWeek)
      .filter(invoice => invoice.pagada)
      .reduce((total, invoice) => total + amount(invoice), 0);
    const monthTotal = monthPayments.reduce((total, invoice) => total + amount(invoice), 0);
    const previousMonthTotal = invoicesFrom(previousMonth)
      .filter(invoice => invoice.pagada)
      .reduce((total, invoice) => total + amount(invoice), 0);
    const debtTotal = unpaidInvoices.reduce((total, invoice) => total + amount(invoice), 0);
    const allInvoicesTotal = invoicesFrom(debtInvoices)
      .reduce((total, invoice) => total + amount(invoice), 0);
    const debtShare = allInvoicesTotal ? (debtTotal / allInvoicesTotal) * 100 : 0;
    const weekValues = dailySums(weekPayments, thisWeekStart, elapsedWeekDays, 'fechaPago');
    const monthValues = dailySums(monthPayments, thisMonthStart, monthDays, 'fechaPago');
    const debtValues = dailySums(unpaidInvoices, debtChartStart, 7, 'creadoEn');
    const weekRows = dailyRows(weekPayments, thisWeekStart, elapsedWeekDays, 'fechaPago');
    const monthRows = dailyRows(monthPayments, thisMonthStart, monthDays, 'fechaPago');

    document.getElementById('metric-ventas-semana').textContent = currency.format(weekTotal);
    document.getElementById('metric-ventas-mes').textContent = currency.format(monthTotal);
    document.getElementById('metric-deudas').textContent = currency.format(debtTotal);
    renderTrend('trend-ventas-semana', weekTotal, previousWeekTotal, 'en comparación a la semana anterior');
    renderTrend('trend-ventas-mes', monthTotal, previousMonthTotal, 'en comparación al mes anterior');
    const debtTrend = document.getElementById('trend-deudas');
    debtTrend.textContent = `${Math.round(debtShare)}% del monto total facturado pendiente`;
    debtTrend.classList.remove('positive', 'negative', 'neutral');
    debtTrend.classList.add(debtTotal > 0 ? 'negative' : 'positive');

    renderLineChart('chart-ventas-semana', weekValues, '#ef6326');
    renderLineChart('chart-ventas-mes', monthValues, '#315b9a');
    renderLineChart('chart-deudas', debtValues, '#dc3545');

    detailsByMetric.set('week', {
      title: 'Ventas de la semana',
      period: `Desde el ${formatDate(thisWeekStart)} hasta el ${formatDate(today)}`,
      total: weekTotal,
      color: '#ef6326',
      chartValues: weekValues,
      columns: ['Fecha de pago', 'Facturas', 'Ventas'],
      rows: weekRows.map(row => [formatDate(row.date), String(row.count), currency.format(row.total)])
    });
    detailsByMetric.set('month', {
      title: 'Ventas del mes',
      period: `Desde el ${formatDate(thisMonthStart)} hasta el ${formatDate(today)}`,
      total: monthTotal,
      color: '#315b9a',
      chartValues: monthValues,
      columns: ['Fecha de pago', 'Facturas', 'Ventas'],
      rows: monthRows.map(row => [formatDate(row.date), String(row.count), currency.format(row.total)])
    });
    const orderedDebts = [...unpaidInvoices].sort((first, second) => {
      const firstDate = invoiceDate(first, 'creadoEn');
      const secondDate = invoiceDate(second, 'creadoEn');
      return (secondDate?.getTime() ?? 0) - (firstDate?.getTime() ?? 0);
    });
    detailsByMetric.set('debts', {
      title: 'Deudas pendientes',
      period: `${unpaidInvoices.length} facturas pendientes · línea: nuevas deudas de los últimos 7 días`,
      total: debtTotal,
      color: '#dc3545',
      chartValues: debtValues,
      columns: ['Fecha de factura', 'N.º de factura', 'Cliente', 'Deuda'],
      rows: orderedDebts.map(invoice => {
        const date = invoiceDate(invoice, 'creadoEn');
        return [
          date ? formatDate(date) : 'Sin fecha',
          invoice.idFactura || 'Factura',
          invoice.clienteNombre || 'Cliente sin nombre',
          currency.format(amount(invoice))
        ];
      })
    });
  } catch (error) {
    console.error('Error al cargar las métricas desde Firestore:', error);
    detailsByMetric.clear();
    ['metric-ventas-semana', 'metric-ventas-mes', 'metric-deudas'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
    ['trend-ventas-semana', 'trend-ventas-mes', 'trend-deudas'].forEach(id => {
      document.getElementById(id).textContent = 'No se pudieron cargar las métricas';
    });
    setMetricError('No se pudieron cargar las métricas desde Firebase. Verifica la conexión a Internet y que la configuración de Firebase permita el acceso.');
  }
}
