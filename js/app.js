import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCsHE-Ee3wLKWRz_Lz4nEXAiuF50JZFkno",
  authDomain: "gestor-fiado.firebaseapp.com",
  databaseURL: "https://gestor-fiado-default-rtdb.firebaseio.com",
  projectId: "gestor-fiado",
  storageBucket: "gestor-fiado.firebasestorage.app",
  messagingSenderId: "1020356204799",
  appId: "1:1020356204799:web:48991a7bb41393f14054ca"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Referencias del DOM
const saludoUsuario = document.getElementById('saludo-usuario');
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

// Elementos de la modal de vista previa
const previewImg = document.getElementById('preview-img');
const previewTitulo = document.getElementById('preview-titulo');
const btnDescargarImg = document.getElementById('btn-descargar-img');
const btnMarcarPagada = document.getElementById('btn-marcar-pagada');

// Campos automáticos del sistema
const autoFacturaId = document.getElementById('auto-factura-id');
const autoFecha = document.getElementById('auto-fecha');
const autoHora = document.getElementById('auto-hora');

let facturaActualSeleccionada = null;

// Cargar Datos al Iniciar
document.addEventListener('DOMContentLoaded', () => {
  actualizarSaludoHorario();
  cargarHistorialFacturas();
});

// Actualizar Saludo Dinámico según la hora
let nombre = "Rafael";
function actualizarSaludoHorario() {
  const horaActual = new Date().getHours();
  let saludo = "Buen día";
  if (horaActual >= 12 && horaActual < 19) {
    saludo = "Buenas tardes";
  } else if (horaActual >= 19 || horaActual < 5) {
    saludo = "Buenas noches";
  }
  if (saludoUsuario) {
    saludoUsuario.textContent = `${saludo}, ${nombre}`;
  }
}

//FUNCIONES PARA LA FECHA
function mostrarFecha (){
  const fecha = new Date();

  const diasSemana = [
    'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'
  ];
  const diaSemana = diasSemana[fecha.getDay()];

  const diaNumero = fecha.getDate();

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const mesEscrito = meses[fecha.getMonth()];

  document.getElementById("diaSemana").textContent = diaSemana;
  document.getElementById("diaNumero").textContent = diaNumero;
  document.getElementById("mes").textContent = mesEscrito;
}
document.addEventListener("DOMContentLoaded", mostrarFecha)

// Manejo de Modal Formulario
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

// Manejo de Modal Vista Previa
const cerrarModalPreview = () => {
  modalPreview.classList.add('hidden');
  facturaActualSeleccionada = null;
};
btnCerrarPreview.addEventListener('click', cerrarModalPreview);

// Generar Metadatos Automáticos
function prepararDatosAutomaticos() {
  const ahora = new Date();
  const idFactura = 'FAC-' + Math.floor(100000 + Math.random() * 900000);
  const fecha = ahora.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = ahora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

  autoFacturaId.textContent = idFactura;
  autoFecha.textContent = fecha;
  autoHora.textContent = hora;
}

// Filas de productos dinámicas
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

btnAgregarProducto.addEventListener('click', agregarFilaProducto);

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

// Guardar e Integrar con html2canvas + Firebase
formFactura.addEventListener('submit', async (e) => {
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

    // Esperar a que la imagen cargue correctamente antes de procesar el Canvas
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

    cerrarModalForm();
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
});

// Mostrar Modal de Imagen Previa
function mostrarVistaPrevia(factura) {
  facturaActualSeleccionada = factura;
  previewImg.src = factura.imagenBase64;
  previewTitulo.textContent = `Factura ${factura.idFactura}`;
  btnDescargarImg.href = factura.imagenBase64;
  btnDescargarImg.download = `${factura.idFactura}${factura.pagada ? '_PAGADA' : ''}.png`;

  if (factura.pagada) {
    btnMarcarPagada.style.display = 'none';
  } else {
    btnMarcarPagada.style.display = 'inline-block';
  }
  modalPreview.classList.remove('hidden');
}

// Marcar Factura como Pagada + Regeneración de Imagen
btnMarcarPagada.addEventListener('click', async () => {
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
    cerrarModalPreview();
    cargarHistorialFacturas();
  } catch (error) {
    console.error('Error al marcar como pagada:', error);
    alert('Ocurrió un error al procesar el pago: ' + error.message);
  } finally {
    btnMarcarPagada.disabled = false;
    btnMarcarPagada.textContent = 'Marcar como Pagada';
  }
});

// Función auxiliar para estampar la marca roja "PAGADA"
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

// Cargar Historial desde Firestore
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