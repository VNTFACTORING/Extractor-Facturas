export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { fileData, mimeType } = req.body;
  if (!fileData || !mimeType) return res.status(400).json({ error: 'Missing fileData or mimeType' });

  const content = mimeType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileData } }
    : { type: 'image', source: { type: 'base64', media_type: mimeType, data: fileData } };

  const prompt = `Eres experto en documentos tributarios chilenos. Extrae los campos de esta factura y responde SOLO con JSON válido, sin markdown ni texto adicional:
{"tipo_documento":"Factura Electrónica|Boleta|Nota de Débito|etc","numero_folio":"número","rut_emisor":"XX.XXX.XXX-X","razon_social_emisor":"nombre completo","rut_deudor":"XX.XXX.XXX-X","razon_social_deudor":"nombre completo","fecha_emision":"DD/MM/YYYY","fecha_vencimiento":"DD/MM/YYYY o null","descripcion":"descripción breve del bien o servicio","monto_neto":entero,"iva":entero,"total":entero,"confianza":{"rut_emisor":"alta|media|baja","rut_deudor":"alta|media|baja","numero_folio":"alta|media|baja","monto_neto":"alta|media|baja","total":"alta|media|baja"}}
Montos como enteros sin puntos ni símbolos. Campos no visibles = null.`;

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
        max_tokens: 1000,
        messages: [{ role: 'user', content: [content, { type: 'text', text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || 'API error' });
    }

    const data = await response.json();
    const text = data.content?.map(i => i.text || '').join('').replace(/```json|```/g, '').trim();
    const extracted = JSON.parse(text);
    return res.status(200).json(extracted);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
