const WEBHOOK_URL = "https://n8nyt.soriasystems.site/webhook-test/unir-tfm-citas"; // Configurado para el nuevo flujo independiente del TFM UNIR

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
