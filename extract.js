export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { fileData, mimeType } = req.body;
  if (!fileData || !mimeType) return res.status(400).json({ error: 'Faltan parámetros' });

  const content = mimeType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileData } }
    : { type: 'image', source: { type: 'base64', media_type: mimeType, data: fileData } };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [content, { type: 'text', text: `Eres experto en documentos tributarios chilenos. Extrae los campos y responde SOLO con JSON válido sin markdown:
{"tipo_documento":"Factura Electrónica|Boleta|Nota de Débito|etc","numero_folio":"número","rut_emisor":"XX.XXX.XXX-X","razon_social_emisor":"nombre","rut_deudor":"XX.XXX.XXX-X","razon_social_deudor":"nombre","fecha_emision":"DD/MM/YYYY","monto_neto":entero,"iva":entero,"total":entero,"confianza":{"rut_emisor":"alta|media|baja","rut_deudor":"alta|media|baja","monto_neto":"alta|media|baja","total":"alta|media|baja"}}
Montos como enteros sin puntos ni símbolos. Campos no visibles = null.` }]
        }]
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || 'Error de API' });
    }

    const data = await response.json();
    const text = data.content?.map(i => i.text || '').join('').replace(/```json|```/g, '').trim();
    return res.status(200).json(JSON.parse(text));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
