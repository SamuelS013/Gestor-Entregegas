// aviso.js
export function initAviso({
  archivo = 'aviso-template.html',
  clave = 'aviso_visto_v1',
  ancho = '400px',
  alto = '500px',
} = {}) {
  // Si ya lo vio, no hacemos nada
  if (localStorage.getItem(clave)) return;

  // Crear overlay
  const overlay = document.createElement('div');
  overlay.id = 'aviso-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;

  // Crear iframe
  const iframe = document.createElement('iframe');
  iframe.src = archivo;
  iframe.style.cssText = `
    width: ${ancho};
    max-width: 90%;
    height: ${alto};
    border: none;
    border-radius: 12px;
    background: white;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  `;

  overlay.appendChild(iframe);
  document.body.appendChild(overlay);

  // Fade in
  requestAnimationFrame(() => (overlay.style.opacity = '1'));

  // Función para cerrar y marcar como visto
  function cerrar() {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
    localStorage.setItem(clave, 'true');
    window.removeEventListener('message', onMessage);
  }

  // Escuchar al iframe
  function onMessage(e) {
    if (e.data === 'cerrar-aviso') cerrar();
  }
  window.addEventListener('message', onMessage);

  // Cerrar al hacer clic fuera
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrar();
  });

  // Cerrar con la tecla Escape
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') {
      cerrar();
      document.removeEventListener('keydown', onEsc);
    }
  });
}