// ============================================================
// app.js
// Punto de entrada de la aplicación.
// Contiene la lógica "simple" de UI: saludo, fecha, y arranque
// del resto de módulos. NO conoce Firebase ni las facturas.
// ============================================================

import { initFacturas } from './factura.js';

// Referencias del DOM (solo lo que este módulo usa)
const saludoUsuario = document.getElementById('saludo-usuario');
const dolar = document.getElementById('dolar');
const nombre = "Rafael";

// ------------------------------------------------------------
// Saludo dinámico según la hora
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Mostrar fecha en formato "Hoy es lunes, 23 de Septiembre"
// ------------------------------------------------------------
function mostrarFecha() {
  const fecha = new Date();

  const diasSemana = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
  ];
  const diaSemana = diasSemana[fecha.getDay()];
  const diaNumero = fecha.getDate();

  const meses = [
    'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
    'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'
  ];
  const mesEscrito = meses[fecha.getMonth()];

  document.getElementById("diaSemana").textContent = diaSemana;
  document.getElementById("diaNumero").textContent = diaNumero;
  document.getElementById("mes").textContent = mesEscrito;
}

//FUNCION PARA EL DOLAR

async function actualizarDolar() {
  const url = 'https://ve.dolarapi.com/v1/dolares/oficial';
  
  try {
    const respuesta = await fetch(url);
    const datos = await respuesta.json();
    
    // El valor está en datos.promedio
    const valorDolar = datos.promedio.toFixed(2);

    if (dolar){
      dolar.textContent = `${valorDolar} Bs.`;
    }
    
  } catch (error) {
    console.error('Error al obtener el dólar:', error);
    document.getElementById('dolar').textContent = '000.00 bs.';
  }
}

// ------------------------------------------------------------
// Arranque general
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  actualizarSaludoHorario();
  mostrarFecha();
  actualizarDolar();

  // Inicializa todo el módulo de facturas
  initFacturas();
});