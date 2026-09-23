// ============================================================
// factura.js
// Toda la lógica relacionada con facturas:
//   - Modales (formulario y vista previa)
//   - Filas dinámicas de productos y totales
//   - Generación de imagen (html2canvas)
//   - Guardado / actualización en Firestore
//   - Historial y métricas del dashboard
// ============================================================

import { db, iniciarSesionAnonima } from './firebase.js';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ------------------------------------------------------------
// Referencias del DOM
// ------------------------------------------------------------
const modalForm = document.getElementById('modal-factura');
const modalPreview = document.getElementById('modal-preview');
const formFactura = document.getElementById('form-factura');
const btnAbrirModal = document.getElementById('btn-abrir-modal');
const btnCerrarModal = document.getElementById('btn-cerrar-modal');
const btnCancelar = document.getElementById('btn-cancelar');
const btnCerrarPreview = document.getElementById('btn-cerrar-preview');
const btnGuardar = document.getElementById('btn-guardar-factura');
const btnAgregarProducto = document.getElementById('btn-agregar-producto');
const listaProductos = document.getElementById('lista-productos');
const montoTotalElem = document.getElementById('monto-total');
const metricBalanceVentas = document.getElementById('metric-balance-ventas');
const metricDineroDeuda = document.getElementById('metric-dinero-deuda');
const listaHistorial = document.getElementById('lista-historial');
const listaHistorialPagadas = document.getElementById('lista-historial-pagadas');
const fechaVencimientoInput = document.getElementById('fecha-vencimiento');

// Elementos de la modal de vista previa
const previewImg = document.getElementById('preview-img');
const previewTitulo = document.getElementById('preview-titulo');
const btnDescargarImg = document.getElementById('btn-descargar-img');
const btnMarcarPagada = document.getElementById('btn-marcar-pagada');

// Campos automáticos del sistema
const autoFacturaId = document.getElementById('auto-factura-id');
const autoFecha = document.getElementById('auto-fecha');
const autoHora = document.getElementById('auto-hora');

// Estado local del módulo
let facturaActualSeleccionada = null;

// ------------------------------------------------------------
// API pública del módulo
// ------------------------------------------------------------
export async function initFacturas() {
  // 1. Asegurar sesión anónima ANTES de tocar Firestore
  try {
    await iniciarSesionAnonima();
  } catch (error) {
    console.error('No se pudo iniciar sesión anónima:', error);
    alert('No se pudo conectar de forma segura. Recarga la página.');
    return;
  }

  // 2. Registrar eventos y cargar datos
  registrarEventos();
  cargarHistorialFacturas();
}

// ------------------------------------------------------------
// Registro de todos los listeners
// ------------------------------------------------------------
function registrarEventos() {

  // --- Modal Formulario ---
  btnAbrirModal.addEventListener('click', () => {
    formFactura.reset();
    listaProductos.innerHTML = '';
    montoTotalElem.textContent = '$0.00';
    prepararDatosAutomaticos();
    agregarFilaProducto();
    modalForm.classList.remove('hidden');
  });

  const cerrarModalForm = () => modalForm.classList.add('hidden');
  btnCerrarModal.addEventListener('click', cerrarModalForm);
  btnCancelar.addEventListener('click', cerrarModalForm);

  // --- Modal Vista Previa ---
  const cerrarModalPreview = () => {
    modalPreview.classList.add('hidden');
    facturaActualSeleccionada = null;
  };
  btnCerrarPreview.addEventListener('click', cerrarModalPreview);

  // --- Formulario ---
  btnAgregarProducto.addEventListener('click', agregarFilaProducto);
  formFactura.addEventListener('submit', manejarSubmitFactura);

  // --- Marcar como pagada ---
  btnMarcarPagada.addEventListener('click', manejarMarcarPagada);
}

// ------------------------------------------------------------
// Metadatos automáticos (N° factura, fecha, hora)
// ------------------------------------------------------------
function prepararDatosAutomaticos() {
  const ahora = new Date();
  const idFactura = 'FAC-' + Math.floor(100000 + Math.random() * 900000);
  const fecha = ahora.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = ahora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    
  const fechaVencimiento = new Date(ahora);
  fechaVencimiento.setDate(ahora.getDate() + 7);

  // Formatear a YYYY-MM-DD para el input tipo date
  const año = fechaVencimiento.getFullYear();
  const mes = String(fechaVencimiento.getMonth() + 1).padStart(2, '0'); // Meses son 0-11
  const dia = String(fechaVencimiento.getDate()).padStart(2, '0');
  const fechaParaInput = `${año}-${mes}-${dia}`;
  // --- FIN: Cálculo de la fecha de vencimiento ---

  autoFacturaId.textContent = idFactura;
  autoFecha.textContent = fecha;
  autoHora.textContent = hora;
  fechaVencimientoInput.value = fechaParaInput; // Asignar el valor por defecto
}

// ------------------------------------------------------------
// Filas dinámicas de productos
// ------------------------------------------------------------
function agregarFilaProducto() {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="number" class="p-cant" min="1" value="1" required></td>
    <td><input type="text" class="p-desc" placeholder="Descripción" required></td>
    <td><input type="number" class="p-precio" min="0" step="0.01" placeholder="0.00" required></td>
    <td><input type="text" class="p-total" value="0.00" readonly></td>
    <td><button type="button" class="btn-del-row">&times;</button></td>
  `;

  const cantInput = tr.querySelector('.p-cant');
  const precioInput = tr.querySelector('.p-precio');
  const btnEliminar = tr.querySelector('.btn-del-row');

  cantInput.addEventListener('input', () => calcularFila(tr));
  precioInput.addEventListener('input', () => calcularFila(tr));
  btnEliminar.addEventListener('click', () => {
    tr.remove();
    calcularTotalGeneral();
  });

  listaProductos.appendChild(tr);
}

function calcularFila(tr) {
  const cant = parseFloat(tr.querySelector('.p-cant').value) || 0;
  const precio = parseFloat(tr.querySelector('.p-precio').value) || 0;
  const total = cant * precio;
  tr.querySelector('.p-total').value = total.toFixed(2);
  calcularTotalGeneral();
}

function calcularTotalGeneral() {
  let totalGeneral = 0;
  document.querySelectorAll('.p-total').forEach(input => {
    totalGeneral += parseFloat(input.value) || 0;
  });
  montoTotalElem.textContent = `$${totalGeneral.toFixed(2)}`;
}

// ------------------------------------------------------------
// Submit: genera imagen con html2canvas y guarda en Firestore
// ------------------------------------------------------------
async function manejarSubmitFactura(e) {
  e.preventDefault();

  const filas = document.querySelectorAll('#lista-productos tr');
  if (filas.length === 0) {
    alert('Debe agregar al menos un producto.');
    return;
  }

  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Procesando...';
  let tempContainer = null;

  try {
    const idFactura = autoFacturaId.textContent;
    const fecha = autoFecha.textContent;
    const hora = autoHora.textContent;
     // --- INICIO: Leer y formatear la fecha de vencimiento ---
    const fechaVencimientoInputValue = fechaVencimientoInput.value; // Formato YYYY-MM-DD
    // Convertir a un formato legible (DD/MM/YYYY)
    const partesFecha = fechaVencimientoInputValue.split('-');
    const fechaVencimientoFormateada = `${partesFecha[2]}/${partesFecha[1]}/${partesFecha[0]}`;
    // --- FIN: Leer y formatear la fecha de vencimiento ---
    const clienteNombre = document.getElementById('cliente-nombre').value;
    const clienteTelefono = document.getElementById('cliente-telefono').value;
    const clienteDoc = document.getElementById('cliente-doc').value || 'N/A';
    const clienteUbicacion = document.getElementById('cliente-ubicacion').value || 'N/A';

    const productos = [];
    let totalGeneral = 0;

   

    filas.forEach(tr => {
      const cant = parseFloat(tr.querySelector('.p-cant').value) || 0;
      const desc = tr.querySelector('.p-desc').value;
      const precio = parseFloat(tr.querySelector('.p-precio').value) || 0;
      const total = cant * precio;
      productos.push({ cant, desc, precio, total });
      totalGeneral += total;
    });

    const response = await fetch('factura-template.html');
    if (!response.ok) throw new Error('No se pudo cargar factura-template.html');
    const htmlTemplate = await response.text();

    tempContainer = document.createElement('div');
    tempContainer.className = 'render-hidden';
    tempContainer.innerHTML = htmlTemplate;
    document.body.appendChild(tempContainer);

    tempContainer.querySelector('#rf-id').textContent = idFactura;
    tempContainer.querySelector('#rf-fecha').textContent = fecha;
    tempContainer.querySelector('#rf-vencimiento').textContent = fechaVencimientoFormateada; // <- AÑADIR ESTA LÍNEA
    tempContainer.querySelector('#rf-nombre').textContent = clienteNombre;
    tempContainer.querySelector('#rf-telefono').textContent = clienteTelefono;
    tempContainer.querySelector('#rf-doc').textContent = clienteDoc;
    tempContainer.querySelector('#rf-ubicacion').textContent = clienteUbicacion;
    tempContainer.querySelector('#rf-total').textContent = `$${totalGeneral.toFixed(2)}`;

    const rfItems = tempContainer.querySelector('#rf-items');
    rfItems.innerHTML = '';
    productos.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.cant}</td>
        <td>${p.desc}</td>
        <td>$${p.precio.toFixed(2)}</td>
        <td>$${p.total.toFixed(2)}</td>
      `;
      rfItems.appendChild(tr);
    });

    const renderTarget = tempContainer.querySelector('#factura-render');

    // Esperar a que la imagen del logo cargue antes del canvas
    const imgLogo = renderTarget.querySelector('.f-logo-img');
    if (imgLogo && !imgLogo.complete) {
      await new Promise((resolve) => {
        imgLogo.onload = resolve;
        imgLogo.onerror = resolve;
      });
    }

    const canvas = await html2canvas(renderTarget, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true
    });

    const imagenBase64 = canvas.toDataURL('image/png');

    const nuevaFactura = {
      idFactura,
      fecha,
      hora,
      fechaVencimiento: fechaVencimientoFormateada, // <- AÑADIR ESTA LÍNEA para guardar en la BD
      clienteNombre,
      clienteTelefono,
      clienteDoc,
      clienteUbicacion,
      productos,
      montoTotal: totalGeneral,
      imagenBase64,
      pagada: false,
      creadoEn: new Date()
    };

    const docRef = await addDoc(collection(db, 'facturas'), nuevaFactura);
    nuevaFactura.id = docRef.id;

    modalForm.classList.add('hidden');
    mostrarVistaPrevia(nuevaFactura);
    cargarHistorialFacturas();

  } catch (error) {
    console.error('Error detectado:', error);
    alert('Error al guardar: ' + error.message);
  } finally {
    if (tempContainer && tempContainer.parentNode) {
      tempContainer.parentNode.removeChild(tempContainer);
    }
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar y Generar Factura';
  }
}

// ------------------------------------------------------------
// Vista previa de factura
// ------------------------------------------------------------
function mostrarVistaPrevia(factura) {
  facturaActualSeleccionada = factura;
  previewImg.src = factura.imagenBase64;
  previewTitulo.textContent = `Factura ${factura.idFactura}`;
  btnDescargarImg.href = factura.imagenBase64;
  btnDescargarImg.download = `${factura.idFactura}${factura.pagada ? '_PAGADA' : ''}.png`;

  btnMarcarPagada.style.display = factura.pagada ? 'none' : 'inline-block';
  modalPreview.classList.remove('hidden');
}

// ------------------------------------------------------------
// Marcar factura como pagada
// ------------------------------------------------------------
async function manejarMarcarPagada() {
  if (!facturaActualSeleccionada || facturaActualSeleccionada.pagada) return;

  const confirmar = confirm(`¿Deseas marcar la factura ${facturaActualSeleccionada.idFactura} como PAGADA?`);
  if (!confirmar) return;

  btnMarcarPagada.disabled = true;
  btnMarcarPagada.textContent = 'Procesando...';

  try {
    const imagenPagadaBase64 = await estamparMarcaPagado(facturaActualSeleccionada.imagenBase64);
    const docRef = doc(db, 'facturas', facturaActualSeleccionada.id);

    await updateDoc(docRef, {
      pagada: true,
      imagenBase64: imagenPagadaBase64,
      fechaPago: new Date()
    });

    facturaActualSeleccionada.pagada = true;
    facturaActualSeleccionada.imagenBase64 = imagenPagadaBase64;

    alert(`¡Factura ${facturaActualSeleccionada.idFactura} marcada como PAGADA con éxito!`);
    modalPreview.classList.add('hidden');
    facturaActualSeleccionada = null;
    cargarHistorialFacturas();

  } catch (error) {
    console.error('Error al marcar como pagada:', error);
    alert('Ocurrió un error al procesar el pago: ' + error.message);
  } finally {
    btnMarcarPagada.disabled = false;
    btnMarcarPagada.textContent = 'Marcar como Pagada';
  }
}

// ------------------------------------------------------------
// Estampar marca roja "PAGADA" sobre la imagen
// ------------------------------------------------------------
function estamparMarcaPagado(base64Src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(img, 0, 0);

      const fontSize = Math.floor(canvas.width * 0.15);
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.fillStyle = 'rgba(220, 53, 69, 0.4)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-30 * Math.PI / 180);
      ctx.fillText('PAGADA', 0, 0);

      ctx.strokeStyle = 'rgba(220, 53, 69, 0.4)';
      ctx.lineWidth = Math.floor(fontSize * 0.05);
      ctx.strokeText('PAGADA', 0, 0);
      ctx.restore();

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (err) => reject(err);
    img.src = base64Src;
  });
}

// ------------------------------------------------------------
// Historial + métricas del dashboard
// ------------------------------------------------------------
async function cargarHistorialFacturas() {
  try {
    const q = query(collection(db, 'facturas'), orderBy('creadoEn', 'desc'));
    const querySnapshot = await getDocs(q);

    listaHistorial.innerHTML = '';
    listaHistorialPagadas.innerHTML = '';

    let totalCobradoVentas = 0;
    let totalPendienteDeuda = 0;
    let contadorPendientes = 0;
    let contadorPagadas = 0;

    if (querySnapshot.empty) {
      listaHistorial.innerHTML = '<p class="empty-msg">No hay facturas pendientes registradas.</p>';
      listaHistorialPagadas.innerHTML = '<p class="empty-msg">No hay facturas pagadas aún.</p>';
      metricBalanceVentas.textContent = '$0.00';
      metricDineroDeuda.textContent = '$0.00';
      return;
    }

    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const idDoc = docSnap.id;
      const facturaObj = { ...data, id: idDoc };

      const item = document.createElement('div');
      item.className = `history-item ${data.pagada ? 'paid-item' : ''}`;
      item.innerHTML = `
        <div class="info">
          <h4>${data.clienteNombre}</h4>
          <p>${data.fecha} ${data.hora} | ${data.idFactura}</p>
        </div>
        <div class="amount">$${data.montoTotal.toFixed(2)}</div>
      `;

      item.addEventListener('click', () => {
        mostrarVistaPrevia(facturaObj);
      });

      if (data.pagada) {
        totalCobradoVentas += data.montoTotal || 0;
        contadorPagadas++;
        listaHistorialPagadas.appendChild(item);
      } else {
        totalPendienteDeuda += data.montoTotal || 0;
        contadorPendientes++;
        listaHistorial.appendChild(item);
      }
    });

    if (contadorPendientes === 0) {
      listaHistorial.innerHTML = '<p class="empty-msg">No hay facturas pendientes registradas.</p>';
    }
    if (contadorPagadas === 0) {
      listaHistorialPagadas.innerHTML = '<p class="empty-msg">No hay facturas pagadas aún.</p>';
    }

    metricBalanceVentas.textContent = `$${totalCobradoVentas.toFixed(2)}`;
    metricDineroDeuda.textContent = `$${totalPendienteDeuda.toFixed(2)}`;

  } catch (error) {
    console.error('Error al cargar historial:', error);
  }
}
