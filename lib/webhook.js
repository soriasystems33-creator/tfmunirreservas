const WEBHOOK_URL = "http://localhost:5678/webhook/89e879ec-9e37-483e-b73e-2a15ba04ded6"; // Cambia localhost:5678 por tu dominio de n8n si está en la nube

export async function notifyWebhook(event, data) {
  if (!WEBHOOK_URL) return;
  try {
    console.log(`[webhook] Enviando evento "${event}" a n8n`);
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, ...data })
    });
  } catch (error) {
    console.error(`[webhook] Error enviando a n8n:`, error.message);
  }
}
