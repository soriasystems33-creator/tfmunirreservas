// Webhook deshabilitado en TFM — se integrará en una fase posterior con n8n
// export async function notifyWebhook(event, data) { ... }

export async function notifyWebhook(event, data) {
  // Webhook desactivado en esta versión del TFM
  // Se habilitará en la siguiente fase con workflow n8n propio
  console.log(`[webhook-tfm] Evento "${event}" registrado (webhook pendiente de configurar)`);
}
